class PhysicalInventoryAdmin {
    constructor() {
        this.currentSession = null;
        this.sessions = [];
        this.inventoryItems = [];
        this.pendingEdits = {}; // Store unsaved changes separately
        this.supabase = null;
        this.init();
    }

    async init() {
        // Supabase 클라이언트 초기화
        this.initializeSupabase();
        
        await this.loadSessions();
        this.bindEvents();
        this.renderSessions();
    }

    initializeSupabase() {
        try {
            // 전역 supabase 클라이언트 사용
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
            } else if (window.supabase) {
                // 직접 Supabase 클라이언트 생성
                this.supabase = window.supabase.createClient(
                    'https://vzemucykhxlxgjuldibf.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ'
                );
            } else {
                throw new Error('Supabase 라이브러리가 로드되지 않았습니다.');
            }
            console.log('Supabase 클라이언트 초기화 성공');
        } catch (error) {
            console.error('Supabase 클라이언트 초기화 실패:', error);
            this.showAlert('Supabase 연결에 실패했습니다.', 'danger');
        }
    }

    bindEvents() {
        // 세션 목록 이벤트
        document.addEventListener('click', (e) => {
            // 세션 행 클릭 처리 - 행 자체나 하위 요소 클릭 시 모두 처리
            const sessionRow = e.target.closest('.session-row');
            if (sessionRow) {
                const sessionId = sessionRow.dataset.sessionId;
                this.loadSessionDetails(sessionId);
            } else if (e.target.matches('.complete-session-btn')) {
                this.completeSession();
            } else if (e.target.matches('.refresh-btn')) {
                this.refreshData();
            }
        });



        // 간소화된 필터 이벤트
        const filterBtn = document.getElementById('filterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                this.filterData();
            });
        }

        const clearFilterBtn = document.getElementById('clearFilterBtn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                this.clearFilter();
            });
        }

        // 세션 선택 이벤트
        const sessionSelect = document.getElementById('sessionSelect');
        if (sessionSelect) {
            sessionSelect.addEventListener('change', (e) => {
                const selectedSessionId = e.target.value;
                if (selectedSessionId) {
                    this.loadSessionDetails(selectedSessionId);
                } else {
                    this.showSessionsList();
                }
            });
        }

        // 실사 재고 직접 입력 이벤트
        const addManualItemBtn = document.getElementById('addManualItemBtn');
        if (addManualItemBtn) {
            addManualItemBtn.addEventListener('click', () => {
                this.addManualPhysicalItem();
            });
        }
    }

    async loadSessions() {
        try {
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            const { data, error } = await this.supabase
                .from('physical_inventory_sessions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.sessions = data || [];
        } catch (error) {
            console.error('세션 로드 오류:', error);
            this.showAlert('세션 목록을 불러오는 중 오류가 발생했습니다.', 'danger');
        }
    }

    // 세션 필터링 (기존 함수 제거)
    // async filterSessions() { ... } - 제거됨

    // 세션 필터 초기화 (기존 함수 제거)
    // async clearSessionFilter() { ... } - 제거됨

    async loadSessionDetails(sessionId) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            // Clear pending edits when loading a new session
            this.pendingEdits = {};

            // 세션 정보 로드
            const { data: session, error: sessionError } = await this.supabase
                .from('physical_inventory_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (sessionError) throw sessionError;
            this.currentSession = session;

            // 실사 항목 로드
            const { data: items, error: itemsError } = await this.supabase
                .from('physical_inventory_items')
                .select(`
                    *,
                    parts!inner(part_number, category)
                `)
                .eq('session_id', sessionId);

            if (itemsError) throw itemsError;
            this.inventoryItems = items || [];

            // UI 업데이트
            this.renderSessionDetails();
            this.renderInventoryItems();

            // 세션 상세 섹션 표시
            document.getElementById('sessionDetailsSection').style.display = 'block';
            document.getElementById('sessionsSection').style.display = 'none';

            this.showAlert(`세션 "${session.notes || '세션명 없음'}"의 상세 정보를 불러왔습니다.`, 'success');

        } catch (error) {
            console.error('세션 상세 로드 오류:', error);
            this.showAlert('세션 상세 정보를 불러오는 중 오류가 발생했습니다.', 'danger');
        }
    }

    // 실사 재고 직접 입력을 위한 파트 목록 로드
    async loadPartsForManualInput() {
        try {
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            const { data, error } = await this.supabase
                .from('parts')
                .select('part_number, category')
                .order('part_number');

            if (error) throw error;

            const select = document.getElementById('manualPartSelect');
            if (select) {
                select.innerHTML = `<option value="">${i18n.t('select_part_manual')}</option>`;
                (data || []).forEach(part => {
                    const option = document.createElement('option');
                    option.value = part.part_number;
                    option.textContent = `${part.part_number} - ${part.category}`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('파트 목록 로드 오류:', error);
            this.showAlert('파트 목록을 불러오는 중 오류가 발생했습니다.', 'danger');
        }
    }

    // 실사 재고 직접 입력
    async addManualPhysicalItem() {
        const partNumber = document.getElementById('manualPartSelect')?.value;
        const physicalStock = parseInt(document.getElementById('manualPhysicalStock')?.value);
        const notes = document.getElementById('manualNotes')?.value;

        if (!partNumber) {
            this.showAlert('파트를 선택해주세요.', 'danger');
            return;
        }

        if (!physicalStock || physicalStock < 0) {
            this.showAlert('올바른 실사 수량을 입력해주세요.', 'danger');
            return;
        }

        if (!this.currentSession) {
            this.showAlert('세션을 먼저 선택해주세요.', 'danger');
            return;
        }

        try {
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            // 현재 DB 재고 조회
            const { data: inventoryData } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .single();

            const dbStock = inventoryData ? inventoryData.current_stock : 0;
            const difference = physicalStock - dbStock;

            // 이미 해당 파트가 세션에 있는지 확인
            const existingItem = this.inventoryItems.find(item => item.part_number === partNumber);
            if (existingItem) {
                this.showAlert('이미 실사된 파트입니다. 기존 항목을 수정하거나 삭제 후 다시 추가해주세요.', 'warning');
                return;
            }

            // 실사 항목 추가
            const { data, error } = await this.supabase
                .from('physical_inventory_items')
                .insert({
                    session_id: this.currentSession.id,
                    part_number: partNumber,
                    db_stock: dbStock,
                    physical_stock: physicalStock,
                    difference: difference,
                    status: difference === 0 ? 'MATCHED' : 'DIFFERENCE',
                    notes: `직접 입력 - ${notes || '관리자 입력'}`
                })
                .select()
                .single();

            if (error) throw error;

            // 입력 필드 초기화
            document.getElementById('manualPartSelect').value = '';
            document.getElementById('manualPhysicalStock').value = '';
            document.getElementById('manualNotes').value = '';

            // 세션 상세 정보 새로고침
            await this.loadSessionDetails(this.currentSession.id);

            this.showAlert('실사 재고가 성공적으로 추가되었습니다.', 'success');
        } catch (error) {
            console.error('실사 재고 추가 오류:', error);
            this.showAlert('실사 재고 추가 중 오류가 발생했습니다.', 'danger');
        }
    }

    renderSessions() {
        const tbody = document.getElementById('sessionsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        this.sessions.forEach(session => {
            const row = document.createElement('tr');
            row.className = 'session-row hover:bg-white/10 transition-colors duration-200 cursor-pointer';
            row.dataset.sessionId = session.id;
            
            const statusClass = this.getStatusClass(session.status);

            row.innerHTML = `
                <td>${session.notes || '세션명 없음'}</td>
                <td>${new Date(session.session_date).toLocaleDateString()}</td>
                <td><span class="status-badge ${statusClass}">${this.getStatusText(session.status)}</span></td>
                <td>${new Date(session.created_at).toLocaleString()}</td>
                <td>${session.created_by || '-'}</td>
            `;
            
            tbody.appendChild(row);
        });

        // 세션 선택 드롭다운 업데이트
        this.updateSessionSelect();
    }

    updateSessionSelect() {
        const sessionSelect = document.getElementById('sessionSelect');
        if (!sessionSelect) return;

        // 기존 옵션들 제거 (첫 번째 "세션을 선택하세요" 옵션 제외)
        while (sessionSelect.children.length > 1) {
            sessionSelect.removeChild(sessionSelect.lastChild);
        }

        // 세션들을 드롭다운에 추가
        this.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = `${session.notes || '세션명 없음'} (${new Date(session.session_date).toLocaleDateString()})`;
            sessionSelect.appendChild(option);
        });
    }

    renderSessionDetails() {
        if (!this.currentSession) return;

        // 세션 정보 렌더링
        document.getElementById('sessionName').textContent = this.currentSession.notes || '세션명 없음';
        document.getElementById('sessionDate').textContent = new Date(this.currentSession.session_date).toLocaleDateString();
        document.getElementById('sessionStatus').textContent = this.getStatusText(this.currentSession.status);

        // 실사 항목 목록 렌더링
        this.renderInventoryItems();
    }

    renderInventoryItems() {
        const tbody = document.getElementById('inventoryItemsTableBody');
        if (!tbody) {
            console.error('inventoryItemsTableBody를 찾을 수 없습니다.');
            return;
        }

        console.log('renderInventoryItems 호출됨, 아이템 수:', this.inventoryItems?.length || 0);
        console.log('현재 pendingEdits:', this.pendingEdits);
        
        tbody.innerHTML = '';
        
        if (!this.inventoryItems || this.inventoryItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-white/60">${i18n.t('no_inventory_items')}</td></tr>`;
            return;
        }
        
        this.inventoryItems.forEach(item => {
            // Check for pending edits
            const pendingEdit = this.pendingEdits[item.id];
            const physicalStockValue = pendingEdit?.physical_stock !== undefined ? pendingEdit.physical_stock : item.physical_stock;
            const notesValue = pendingEdit?.notes !== undefined ? pendingEdit.notes : (item.notes || '');
            
            // Set original values for comparison (use pending edit values if available, otherwise use DB values)
            const originalPhysicalStock = pendingEdit?.physical_stock !== undefined ? pendingEdit.physical_stock : item.physical_stock;
            const originalNotes = pendingEdit?.notes !== undefined ? pendingEdit.notes : (item.notes || '');
            
            // 확정 여부 확인 (개별 항목 상태 기반)
            const isConfirmed = item.status === 'COMPLETED';
            
            console.log(`아이템 ${item.id} 렌더링:`, {
                itemId: item.id,
                itemIdType: typeof item.id,
                itemPhysicalStock: item.physical_stock,
                pendingPhysicalStock: pendingEdit?.physical_stock,
                finalPhysicalStock: physicalStockValue,
                originalPhysicalStock: originalPhysicalStock,
                itemNotes: item.notes,
                pendingNotes: pendingEdit?.notes,
                finalNotes: notesValue,
                originalNotes: originalNotes,
                isConfirmed: isConfirmed,
                confirmedAt: item.confirmed_at
            });
            
            const row = document.createElement('tr');
            const statusClass = this.getStatusClass(item.status);
            const differenceClass = item.difference > 0 ? 'text-success' : 
                                  item.difference < 0 ? 'text-danger' : 'text-muted';

            // Add pending-edit class if there are unsaved changes and not confirmed
            if (pendingEdit && !isConfirmed) {
                row.classList.add('pending-edit-row');
                // 인라인 스타일 추가로 노란색 하이라이트 강제 적용
                row.style.backgroundColor = '#fefce8';
                row.style.borderLeft = '4px solid #facc15';
                console.log(`아이템 ${item.id}에 pending-edit-row 클래스 추가됨, pendingEdit:`, pendingEdit);
            } else {
                console.log(`아이템 ${item.id}에는 pending edit 없음 또는 이미 확정됨`);
            }

            // 확정된 항목인 경우 스타일 적용
            if (isConfirmed) {
                row.style.backgroundColor = '#f0f9ff';
                row.style.borderLeft = '4px solid #3b82f6';
            }

            row.innerHTML = `
                <td>${item.part_number}<br><small>${item.parts?.category || '-'}</small></td>
                <td>${item.system_stock || item.db_stock || 0}</td>
                <td>
                    <div class="flex items-center space-x-1">
                        <input type="number" 
                               class="physical-stock-input w-20 px-2 py-1 bg-white/90 backdrop-blur-md border border-gray-300 rounded text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${isConfirmed ? 'opacity-50 cursor-not-allowed' : ''}" 
                               value="${physicalStockValue}" 
                               min="0"
                               data-item-id="${item.id}"
                               data-original-value="${originalPhysicalStock}"
                               title="${isConfirmed ? '이미 완료된 항목입니다' : '스캔된 수량을 수정할 수 있습니다'}"
                               ${isConfirmed ? 'disabled' : ''}>
                        <small class="text-white/60 text-xs">(스캔값)</small>
                        ${isConfirmed ? '<small class="text-blue-400 text-xs">✓ 확정됨</small>' : ''}
                    </div>
                </td>
                <td class="${differenceClass}">${item.difference > 0 ? '+' : ''}${item.difference}</td>
                <td><span class="status-badge ${statusClass}">${this.getStatusText(item.status)}</span></td>
                <td>
                    <div class="flex items-center space-x-1">
                        <input type="text" 
                               class="notes-input w-44 px-2 py-1 bg-white/90 backdrop-blur-md border border-gray-300 rounded text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${isConfirmed ? 'opacity-50 cursor-not-allowed' : ''}" 
                               value="${notesValue}" 
                               data-item-id="${item.id}"
                               data-original-value="${originalNotes}"
                               title="${isConfirmed ? '이미 완료된 항목입니다' : '비고를 입력할 수 있습니다'}"
                               placeholder="비고 입력"
                               ${isConfirmed ? 'disabled' : ''}>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });

        console.log('테이블 렌더링 완료, 이벤트 바인딩 시작');
        // 실사 재고 입력 필드에 이벤트 리스너 추가
        this.bindInventoryItemEvents();
    }

    // 실사 항목 이벤트 바인딩
    bindInventoryItemEvents() {
        console.log('bindInventoryItemEvents 호출됨');
        
        // 실사 재고 수량 변경 이벤트
        const stockInputs = document.querySelectorAll('.physical-stock-input');
        console.log('실사 재고 입력 필드 수:', stockInputs.length);
        stockInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                console.log('실사 재고 입력 변경됨:', e.target.value);
                this.updatePhysicalStock(e.target);
            });
            
            // Enter 키로 즉시 저장
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Enter 키로 실사 재고 저장:', e.target.value);
                    this.updatePhysicalStock(e.target);
                    e.target.blur(); // 포커스 해제
                }
            });
        });

        // 세션 완료 버튼 이벤트
        const completeSessionBtn = document.querySelector('.complete-session-btn');
        if (completeSessionBtn) {
            completeSessionBtn.addEventListener('click', () => {
                console.log('세션 완료 버튼 클릭됨');
                this.showCompleteSessionModal();
            });
        }

        // 비고 입력 필드 이벤트
        const notesInputs = document.querySelectorAll('.notes-input');
        console.log('비고 입력 필드 수:', notesInputs.length);
        notesInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                console.log('비고 입력 변경됨:', e.target.value);
                this.updateNotes(e.target);
            });
            
            // Enter 키 이벤트 추가
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur(); // 포커스 해제하여 change 이벤트 트리거
                }
            });
        });
    }

    // 실사 재고 수량 업데이트 (즉시 DB 반영)
    async updatePhysicalStock(input) {
        const itemId = input.dataset.itemId;
        const newValue = parseInt(input.value);
        const originalValue = parseInt(input.dataset.originalValue);

        console.log('updatePhysicalStock 호출:', { 
            itemId, 
            itemIdType: typeof itemId,
            newValue, 
            originalValue,
            inventoryItemsLength: this.inventoryItems.length,
            inventoryItemsIds: this.inventoryItems.map(item => ({ id: item.id, idType: typeof item.id }))
        });

        // Safety checks
        if (!itemId) {
            console.error('itemId가 없습니다');
            this.showAlert('항목 ID가 없습니다.', 'danger');
            return;
        }

        if (!this.inventoryItems || this.inventoryItems.length === 0) {
            console.error('inventoryItems가 비어있습니다');
            this.showAlert('인벤토리 데이터가 로드되지 않았습니다.', 'danger');
            return;
        }

        // 해당 항목 찾기 (타입 안전성 고려)
        const item = this.inventoryItems.find(item => String(item.id) === String(itemId));
        if (!item) {
            console.error('항목을 찾을 수 없습니다:', {
                itemId,
                itemIdType: typeof itemId,
                availableIds: this.inventoryItems.map(item => ({ id: item.id, idType: typeof item.id }))
            });
            this.showAlert('항목을 찾을 수 없습니다.', 'danger');
            input.value = originalValue;
            return;
        }

        // COMPLETED 상태인지 확인 (PENDING 상태는 수정 가능)
        if (item.status === 'COMPLETED') {
            console.log('이미 완료된 항목입니다:', item);
            this.showAlert('이미 완료된 항목은 수정할 수 없습니다.', 'warning');
            input.value = originalValue;
            return;
        }

        if (newValue < 0) {
            this.showAlert('수량은 0 이상이어야 합니다.', 'danger');
            input.value = originalValue;
            return;
        }

        if (newValue === originalValue) {
            // If no change, remove from pending edits
            if (this.pendingEdits[itemId]) {
                delete this.pendingEdits[itemId].physical_stock;
                if (Object.keys(this.pendingEdits[itemId]).length === 0) {
                    delete this.pendingEdits[itemId];
                }
            }
            console.log('변경사항 없음, pending edits 제거됨');
            return; // 변경사항 없음
        }

        console.log('항목 찾음:', item);

        // Initialize pending edit if it doesn't exist
        if (!this.pendingEdits[itemId]) {
            this.pendingEdits[itemId] = {};
        }

        // Store the change in pending edits
        this.pendingEdits[itemId].physical_stock = newValue;

        // Calculate difference and status based on pending value
        const dbStock = item.system_stock || item.db_stock || 0;
        const difference = newValue - dbStock;
        const status = difference === 0 ? 'MATCHED' : 'DIFFERENCE';

        // Update the pending edit with calculated values
        this.pendingEdits[itemId].difference = difference;
        this.pendingEdits[itemId].status = status;

        // 실시간으로 차이 표시 업데이트
        this.updateDifferenceDisplay(itemId, difference);

        // 수정 중인 항목 시각적 표시
        this.highlightPendingEdit(itemId);

        // physical_inventory_items만 즉시 업데이트 (inventory는 세션 완료 시에만)
        try {
            console.log('실사 재고 즉시 DB 반영 시작 (physical_inventory_items만):', itemId, newValue);
            
            // physical_inventory_items 테이블만 업데이트
            const { error: itemError } = await this.supabase
                .from('physical_inventory_items')
                .update({ 
                    physical_stock: newValue
                })
                .eq('id', itemId);

            if (itemError) {
                console.error('physical_inventory_items 업데이트 오류:', itemError);
                this.showAlert('실사 재고 업데이트 실패: ' + itemError.message, 'danger');
                input.value = originalValue;
                return;
            }

            // 로컬 데이터 업데이트
            item.physical_stock = newValue;
            const dbStock = item.system_stock || item.db_stock || 0;
            item.difference = newValue - dbStock;

            console.log('실사 재고 즉시 DB 반영 완료 (physical_inventory_items만):', itemId, newValue);
            this.showAlert('실사 재고가 저장되었습니다. (확정 시 재고 반영)', 'success');

        } catch (error) {
            console.error('실사 재고 DB 반영 오류:', error);
            this.showAlert('실사 재고 반영 중 오류가 발생했습니다: ' + error.message, 'danger');
            input.value = originalValue;
        }

        // 테이블 다시 렌더링하여 시각적 피드백 업데이트
        this.renderInventoryItems();

        // 인라인 스타일 강제 적용
        setTimeout(() => {
            const row = input.closest('tr');
            if (row && this.pendingEdits[itemId]) {
                row.style.backgroundColor = '#fefce8';
                row.style.borderLeft = '4px solid #facc15';
                console.log('인라인 스타일 적용됨:', row);
            }
        }, 100);

        console.log('실사 재고 즉시 DB 반영 완료:', newValue, 'pendingEdits:', this.pendingEdits);
    }

    // 비고 업데이트 (로컬만)
    updateNotes(input) {
        const itemId = input.dataset.itemId;
        const newValue = input.value.trim();
        const originalValue = input.dataset.originalValue || '';

        console.log('updateNotes 호출:', { 
            itemId, 
            itemIdType: typeof itemId,
            newValue, 
            originalValue,
            inventoryItemsLength: this.inventoryItems.length,
            inventoryItemsIds: this.inventoryItems.map(item => ({ id: item.id, idType: typeof item.id }))
        });

        // Safety checks
        if (!itemId) {
            console.error('itemId가 없습니다');
            this.showAlert('항목 ID가 없습니다.', 'danger');
            return;
        }

        if (!this.inventoryItems || this.inventoryItems.length === 0) {
            console.error('inventoryItems가 비어있습니다');
            this.showAlert('인벤토리 데이터가 로드되지 않았습니다.', 'danger');
            return;
        }

        // 해당 항목 찾기 (타입 안전성 고려)
        const item = this.inventoryItems.find(item => String(item.id) === String(itemId));
        if (!item) {
            console.error('항목을 찾을 수 없습니다:', {
                itemId,
                itemIdType: typeof itemId,
                availableIds: this.inventoryItems.map(item => ({ id: item.id, idType: typeof item.id }))
            });
            this.showAlert('항목을 찾을 수 없습니다.', 'danger');
            input.value = originalValue;
            return;
        }

        // COMPLETED 상태인지 확인 (PENDING 상태는 수정 가능)
        if (item.status === 'COMPLETED') {
            console.log('이미 완료된 항목입니다:', item);
            this.showAlert('이미 완료된 항목은 수정할 수 없습니다.', 'warning');
            input.value = originalValue;
            return;
        }

        if (newValue === originalValue) {
            // If no change, remove from pending edits
            if (this.pendingEdits[itemId]) {
                delete this.pendingEdits[itemId].notes;
                if (Object.keys(this.pendingEdits[itemId]).length === 0) {
                    delete this.pendingEdits[itemId];
                }
            }
            console.log('변경사항 없음, pending edits 제거됨');
            return; // 변경사항 없음
        }

        console.log('항목 찾음:', item);

        // Initialize pending edit if it doesn't exist
        if (!this.pendingEdits[itemId]) {
            this.pendingEdits[itemId] = {};
        }

        // Store the change in pending edits
        this.pendingEdits[itemId].notes = newValue;

        // 테이블 다시 렌더링하여 시각적 피드백 업데이트
        this.renderInventoryItems();

        // 인라인 스타일 강제 적용
        setTimeout(() => {
            const row = input.closest('tr');
            if (row && this.pendingEdits[itemId]) {
                row.style.backgroundColor = '#fefce8';
                row.style.borderLeft = '4px solid #facc15';
                console.log('인라인 스타일 적용됨:', row);
            }
        }, 100);

        console.log('비고 pending edit 업데이트 완료:', newValue, 'pendingEdits:', this.pendingEdits);
    }

    // 삭제 함수 제거됨 (세션 완료 버튼만 사용)

    // 확정 함수 제거됨 (세션 완료 버튼만 사용)

    // inventory 업데이트 및 transaction 기록 (세션 완료 시에만)
    async updateInventoryAndCreateTransactions() {
        console.log('=== inventory 업데이트 및 transaction 기록 시작 (세션 완료 시) ===');
        console.log('현재 pendingEdits:', this.pendingEdits);
        
        const transactions = [];
        const inventoryUpdates = [];

        for (const item of this.inventoryItems) {
            const dbStock = item.system_stock || item.db_stock || 0;
            
            // pendingEdits에서 수정된 값이 있으면 사용, 없으면 원래 값 사용
            const pendingEdit = this.pendingEdits[item.id];
            const finalPhysicalStock = pendingEdit?.physical_stock !== undefined ? 
                pendingEdit.physical_stock : item.physical_stock;
            
            const difference = finalPhysicalStock - dbStock;

            console.log(`파트 ${item.part_number}: DB=${dbStock}, 실사=${finalPhysicalStock}, 차이=${difference}`);
            console.log(`  - 원래 실사재고: ${item.physical_stock}`);
            console.log(`  - 수정된 실사재고: ${finalPhysicalStock}`);
            console.log(`  - pendingEdit:`, pendingEdit);

            // inventory 업데이트 데이터 (트리거 없이 직접 업데이트)
            inventoryUpdates.push({
                part_number: item.part_number,
                current_stock: finalPhysicalStock
            });

            // transaction 기록 데이터 (차이가 있는 경우만, 세션 완료 시에만)
            if (difference !== 0) {
                // pendingEdits에서 수정된 비고가 있으면 사용, 없으면 원래 비고 사용
                const finalNotes = pendingEdit?.notes !== undefined ? 
                    pendingEdit.notes : (item.notes || '');
                
                // 비고가 있으면 포함, 없으면 기본 메시지
                const transactionNotes = finalNotes ? 
                    `실사재고 (${new Date().toLocaleDateString()}) - ${finalNotes}` :
                    `실사재고 (${new Date().toLocaleDateString()})`;

                transactions.push({
                    part_number: item.part_number,
                    transaction_type: 'PHYSICAL_INVENTORY',
                    quantity: difference,
                    reference_id: this.currentSession.notes || `세션_${this.currentSession.id}`,
                    notes: transactionNotes,
                    created_at: new Date().toISOString(),
                    // DB 재고 정보 추가
                    db_stock: dbStock,
                    physical_stock: finalPhysicalStock
                });
            }
        }

        // inventory 테이블 직접 업데이트 (실사 전용, 트리거 우회)
        if (inventoryUpdates.length > 0) {
            console.log('inventory 테이블 직접 업데이트 (실사 전용, 트리거 우회):', inventoryUpdates);
            
            for (const update of inventoryUpdates) {
                try {
                    // 먼저 UPDATE 시도
                    console.log(`inventory UPDATE 시도: ${update.part_number} = ${update.current_stock}`);
                    const { data: updateData, error: updateError } = await this.supabase
                        .from('inventory')
                        .update({ 
                            current_stock: update.current_stock,
                            last_updated: new Date().toISOString()
                        })
                        .eq('part_number', update.part_number)
                        .select();

                    if (updateError) {
                        console.error(`inventory UPDATE 오류 (${update.part_number}):`, updateError);
                        throw updateError;
                    }

                    // UPDATE가 성공했지만 영향받은 행이 0개인 경우 INSERT 시도
                    if (!updateData || updateData.length === 0) {
                        console.log(`inventory INSERT 시도: ${update.part_number} = ${update.current_stock}`);
                        const { error: insertError } = await this.supabase
                            .from('inventory')
                            .insert({
                                part_number: update.part_number,
                                current_stock: update.current_stock,
                                last_updated: new Date().toISOString()
                            });

                        if (insertError) {
                            console.error(`inventory INSERT 오류 (${update.part_number}):`, insertError);
                            throw new Error(`재고 생성 실패 (${update.part_number}): ${insertError.message}`);
                        }
                        console.log(`inventory INSERT 성공: ${update.part_number}`);
                    } else {
                        console.log(`inventory UPDATE 성공: ${update.part_number}`);
                    }
                } catch (error) {
                    console.error(`inventory UPSERT 실패 (${update.part_number}):`, error);
                    throw new Error(`재고 처리 실패 (${update.part_number}): ${error.message}`);
                }
            }
        }

        // inventory_transactions에 기록
        if (transactions.length > 0) {
            console.log('inventory_transactions 기록:', transactions);
            
            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert(transactions);

            if (transactionError) {
                console.error('inventory_transactions 기록 오류:', transactionError);
                throw new Error(`거래 내역 기록 실패: ${transactionError.message}`);
            }
        }

        console.log('=== inventory 업데이트 및 transaction 기록 완료 ===');
    }

    // inventory 테이블만 직접 업데이트 (transaction 기록 없음)
    async updateInventoryOnly() {
        console.log('=== inventory 테이블만 직접 업데이트 시작 ===');
        console.log('현재 pendingEdits:', this.pendingEdits);
        
        const inventoryUpdates = [];

        for (const item of this.inventoryItems) {
            const dbStock = item.system_stock || item.db_stock || 0;
            
            // pendingEdits에서 수정된 값이 있으면 사용, 없으면 원래 값 사용
            const pendingEdit = this.pendingEdits[item.id];
            const finalPhysicalStock = pendingEdit?.physical_stock !== undefined ? 
                pendingEdit.physical_stock : item.physical_stock;
            
            const difference = finalPhysicalStock - dbStock;

            console.log(`파트 ${item.part_number}: DB=${dbStock}, 실사=${finalPhysicalStock}, 차이=${difference}`);

            // inventory 업데이트 데이터 (차이가 있는 경우만)
            if (difference !== 0) {
                inventoryUpdates.push({
                    part_number: item.part_number,
                    current_stock: finalPhysicalStock
                });
            }
        }

        // inventory 테이블 직접 업데이트 (트리거 없이)
        if (inventoryUpdates.length > 0) {
            console.log('inventory 테이블 직접 업데이트:', inventoryUpdates);
            
            for (const update of inventoryUpdates) {
                try {
                    // 먼저 UPDATE 시도
                    console.log(`inventory UPDATE 시도: ${update.part_number} = ${update.current_stock}`);
                    const { data: updateData, error: updateError } = await this.supabase
                        .from('inventory')
                        .update({ 
                            current_stock: update.current_stock,
                            last_updated: new Date().toISOString()
                        })
                        .eq('part_number', update.part_number)
                        .select();

                    if (updateError) {
                        console.error(`inventory UPDATE 오류 (${update.part_number}):`, updateError);
                        throw updateError;
                    }

                    // UPDATE가 성공했지만 영향받은 행이 0개인 경우 INSERT 시도
                    if (!updateData || updateData.length === 0) {
                        console.log(`inventory INSERT 시도: ${update.part_number} = ${update.current_stock}`);
                        const { error: insertError } = await this.supabase
                            .from('inventory')
                            .insert({
                                part_number: update.part_number,
                                current_stock: update.current_stock,
                                last_updated: new Date().toISOString()
                            });

                        if (insertError) {
                            console.error(`inventory INSERT 오류 (${update.part_number}):`, insertError);
                            throw new Error(`재고 생성 실패 (${update.part_number}): ${insertError.message}`);
                        }
                        console.log(`inventory INSERT 성공: ${update.part_number}`);
                    } else {
                        console.log(`inventory UPDATE 성공: ${update.part_number}`);
                    }
                } catch (error) {
                    console.error(`inventory UPSERT 실패 (${update.part_number}):`, error);
                    throw new Error(`재고 처리 실패 (${update.part_number}): ${error.message}`);
                }
            }
        }

        console.log('=== inventory 테이블만 직접 업데이트 완료 ===');
    }


    // 세션 완료 확인 모달 표시
    showCompleteSessionModal() {
        if (!this.currentSession || !this.inventoryItems || this.inventoryItems.length === 0) {
            this.showAlert('완료할 실사 항목이 없습니다.', 'warning');
            return;
        }

        // 차이가 있는 항목들만 필터링 (pendingEdits 반영)
        const itemsWithDifference = this.inventoryItems.filter(item => {
            const dbStock = item.system_stock || item.db_stock || 0;
            const pendingEdit = this.pendingEdits[item.id];
            const finalPhysicalStock = pendingEdit?.physical_stock !== undefined ? 
                pendingEdit.physical_stock : item.physical_stock;
            return (finalPhysicalStock - dbStock) !== 0;
        });

        let modalContent = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                    <h3 class="text-lg font-bold mb-4">세션 완료 확인</h3>
                    <p class="mb-4">다음과 같이 재고가 조정됩니다:</p>
                    <div class="space-y-2 mb-6">
        `;

        if (itemsWithDifference.length > 0) {
            itemsWithDifference.forEach(item => {
                const dbStock = item.system_stock || item.db_stock || 0;
                const pendingEdit = this.pendingEdits[item.id];
                const finalPhysicalStock = pendingEdit?.physical_stock !== undefined ? 
                    pendingEdit.physical_stock : item.physical_stock;
                const finalNotes = pendingEdit?.notes !== undefined ? 
                    pendingEdit.notes : (item.notes || '');
                const difference = finalPhysicalStock - dbStock;
                const differenceText = difference > 0 ? `+${difference}` : difference.toString();
                const differenceClass = difference > 0 ? 'text-green-600' : 'text-red-600';
                
                modalContent += `
                    <div class="p-3 bg-gray-50 rounded mb-2">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-medium">${item.part_number}</span>
                            <span>${dbStock} → ${finalPhysicalStock} <span class="${differenceClass}">(${differenceText})</span></span>
                        </div>
                        ${finalNotes ? `<div class="text-sm text-gray-600 mt-1">비고: ${finalNotes}</div>` : ''}
                    </div>
                `;
            });
        } else {
            modalContent += `
                <div class="text-center text-gray-500 py-4">
                    모든 항목이 DB 재고와 일치합니다.
                </div>
            `;
        }

        modalContent += `
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button id="cancelCompleteBtn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                            취소
                        </button>
                        <button id="confirmCompleteBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            세션 완료
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 기존 모달 제거
        const existingModal = document.querySelector('.fixed.inset-0.bg-black');
        if (existingModal) {
            existingModal.remove();
        }

        // 새 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // 이벤트 리스너 추가
        document.getElementById('cancelCompleteBtn').addEventListener('click', () => {
            document.querySelector('.fixed.inset-0.bg-black').remove();
        });

        document.getElementById('confirmCompleteBtn').addEventListener('click', () => {
            document.querySelector('.fixed.inset-0.bg-black').remove();
            this.completeSession();
        });
    }



    async completeSession() {
        if (!this.currentSession) return;

        try {
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            console.log('=== 세션 완료 시작 ===');
            console.log('현재 세션:', this.currentSession);
            console.log('실사 항목들:', this.inventoryItems);

            // 1. physical_inventory_items의 모든 항목을 COMPLETED로 변경 (수정된 값 반영)
            for (const item of this.inventoryItems) {
                const pendingEdit = this.pendingEdits[item.id];
                const finalPhysicalStock = pendingEdit?.physical_stock !== undefined ? 
                    pendingEdit.physical_stock : item.physical_stock;
                const finalNotes = pendingEdit?.notes !== undefined ? 
                    pendingEdit.notes : (item.notes || '');
                const dbStock = item.system_stock || item.db_stock || 0;
                const difference = finalPhysicalStock - dbStock;

                console.log(`실사 항목 ${item.id} 업데이트:`, {
                    part_number: item.part_number,
                    physical_stock: finalPhysicalStock,
                    notes: finalNotes,
                    difference: difference
                });

                const { error: itemError } = await this.supabase
                    .from('physical_inventory_items')
                    .update({ 
                        status: 'COMPLETED',  // status 업데이트 추가
                        physical_stock: finalPhysicalStock,
                        notes: finalNotes
                        // difference 컬럼 제거 (제약 조건 위반)
                    })
                    .eq('id', item.id);

                if (itemError) {
                    console.error(`실사 항목 ${item.id} 업데이트 오류:`, itemError);
                    throw new Error(`실사 항목 업데이트 실패 (${item.part_number}): ${itemError.message}`);
                }
            }

            // 2. physical_inventory_sessions 상태를 COMPLETED로 변경
            console.log('세션 상태를 COMPLETED로 변경');
            const { error: sessionError } = await this.supabase
                .from('physical_inventory_sessions')
                .update({
                    status: 'COMPLETED'
                })
                .eq('id', this.currentSession.id);

            if (sessionError) {
                console.error('세션 상태 변경 오류:', sessionError);
                throw new Error(`세션 상태 변경 실패: ${sessionError.message}`);
            }

            // 3. inventory 테이블만 직접 업데이트 (transaction 기록 없음)
            await this.updateInventoryOnly();

            // 로컬 상태 업데이트
            if (this.currentSession) {
                this.currentSession.status = 'COMPLETED';
            }

            this.showAlert('실사 세션이 완료되었습니다.', 'success');
            
            // 데이터 새로고침
            await this.loadSessions();
            await this.loadSessionDetails(this.currentSession.id);
            
        } catch (error) {
            console.error('세션 완료 오류:', error);
            this.showAlert(`세션 완료 중 오류가 발생했습니다: ${error.message}`, 'danger');
        }
    }

    // 필터 데이터
    filterData() {
        const sessionSelect = document.getElementById('sessionSelect');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        if (sessionSelect && sessionSelect.value) {
            // 세션 선택이 있으면 해당 세션 로드
            this.loadSessionDetails(sessionSelect.value);
        } else if (startDate && endDate && startDate.value && endDate.value) {
            // 날짜 범위 필터 적용
            this.loadSessionsWithDateFilter(startDate.value, endDate.value);
        } else {
            // 필터 조건이 없으면 전체 세션 로드
            this.loadSessions();
        }
    }

    // 필터 초기화
    clearFilter() {
        const sessionSelect = document.getElementById('sessionSelect');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        if (sessionSelect) sessionSelect.value = '';
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';

        // 전체 세션 로드
        this.loadSessions();
    }

    // 날짜 범위로 세션 필터링
    async loadSessionsWithDateFilter(startDate, endDate) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            const { data, error } = await this.supabase
                .from('physical_inventory_sessions')
                .select('*')
                .gte('created_at', startDate + 'T00:00:00')
                .lte('created_at', endDate + 'T23:59:59')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.sessions = data || [];
            this.renderSessions();
            this.updateSessionSelect();

            this.showAlert(`${startDate} ~ ${endDate} 기간의 세션을 불러왔습니다.`, 'success');

        } catch (error) {
            console.error('세션 필터링 오류:', error);
            this.showAlert('세션 필터링 중 오류가 발생했습니다.', 'danger');
        }
    }

    async refreshData() {
        await this.loadSessions();
        this.renderSessions();
        
        // 현재 세션이 선택되어 있다면 해당 세션의 데이터도 새로고침
        if (this.currentSession) {
            await this.loadSessionDetails(this.currentSession.id);
        }
        
        this.showAlert('데이터가 새로고침되었습니다.', 'success');
    }

    showSessionDetails() {
        document.getElementById('sessionsSection').style.display = 'none';
        document.getElementById('sessionDetailsSection').style.display = 'block';
    }

    async showSessionsList() {
        // 세션 목록 섹션 표시
        document.getElementById('sessionsSection').style.display = 'block';
        document.getElementById('sessionDetailsSection').style.display = 'none';
        

        
        // 세션 선택 드롭다운 초기화
        const sessionSelect = document.getElementById('sessionSelect');
        if (sessionSelect) {
            sessionSelect.value = '';
        }
        
        // 현재 세션 초기화
        this.currentSession = null;
        this.inventoryItems = [];
        
        this.showAlert('세션 목록으로 돌아갔습니다.', 'info');
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    getStatusClass(status) {
        const statusClasses = {
            'ACTIVE': 'status-active',
            'COMPLETED': 'status-completed',
            'CANCELLED': 'status-cancelled',
            'PENDING': 'status-pending',
            'MATCHED': 'status-matched',
            'DIFFERENCE': 'status-difference',
            'ADJUSTED': 'status-adjusted'
        };
        return statusClasses[status] || 'status-default';
    }

    getStatusText(status) {
        const statusTexts = {
            'ACTIVE': '진행중',
            'COMPLETED': '완료',
            'CANCELLED': '취소',
            'PENDING': '대기',
            'MATCHED': '일치',
            'DIFFERENCE': '차이',
            'ADJUSTED': '조정됨'
        };
        return statusTexts[status] || status;
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} p-4 mb-4 rounded-lg border`;
        
        // 타입별 스타일 적용
        switch (type) {
            case 'success':
                alertDiv.className += ' bg-green-100 border-green-400 text-green-700';
                break;
            case 'danger':
                alertDiv.className += ' bg-red-100 border-red-400 text-red-700';
                break;
            case 'warning':
                alertDiv.className += ' bg-yellow-100 border-yellow-400 text-yellow-700';
                break;
            default:
                alertDiv.className += ' bg-blue-100 border-blue-400 text-blue-700';
        }
        
        alertDiv.textContent = message;
        
        // 알림 컨테이너 찾기
        let container = document.getElementById('alertContainer') || 
                       document.querySelector('.flex-1') ||
                       document.body;
        
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
            
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 3000);
        } else {
            // 컨테이너를 찾을 수 없는 경우 간단한 alert 사용
            console.warn('알림을 표시할 컨테이너를 찾을 수 없습니다:', message);
            alert(i18n.t('error_prefix') + message);
        }
    }

    // 디버깅용 함수 (브라우저 콘솔에서 호출 가능)
    debugInventoryState() {
        console.log('=== Inventory Debug Info ===');
        console.log('Current Session:', this.currentSession);
        console.log('Inventory Items Count:', this.inventoryItems?.length || 0);
        console.log('Inventory Items:', this.inventoryItems);
        console.log('Pending Edits:', this.pendingEdits);
        
        // 모든 input 필드의 data-item-id 확인
        const stockInputs = document.querySelectorAll('.physical-stock-input');
        const notesInputs = document.querySelectorAll('.notes-input');
        
        console.log('Stock Inputs:', Array.from(stockInputs).map(input => ({
            itemId: input.dataset.itemId,
            itemIdType: typeof input.dataset.itemId,
            value: input.value,
            originalValue: input.dataset.originalValue
        })));
        
        console.log('Notes Inputs:', Array.from(notesInputs).map(input => ({
            itemId: input.dataset.itemId,
            itemIdType: typeof input.dataset.itemId,
            value: input.value,
            originalValue: input.dataset.originalValue
        })));
        
        console.log('=== End Debug Info ===');
    }


}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    window.physicalInventoryAdmin = new PhysicalInventoryAdmin();
    
    // 차이 표시 실시간 업데이트 함수 추가
    PhysicalInventoryAdmin.prototype.updateDifferenceDisplay = function(itemId, difference) {
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        if (row) {
            const differenceCell = row.querySelector('td:nth-child(4)'); // 차이 컬럼
            if (differenceCell) {
                const differenceClass = difference > 0 ? 'text-green-600 font-bold' : 
                                      difference < 0 ? 'text-red-600 font-bold' : 'text-gray-600';
                const differenceText = difference > 0 ? `+${difference}` : difference;
                
                differenceCell.innerHTML = `<span class="${differenceClass}">${differenceText}</span>`;
            }
        }
    };

    // 수정 중인 항목 하이라이트 함수 추가
    PhysicalInventoryAdmin.prototype.highlightPendingEdit = function(itemId) {
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        if (row) {
            row.style.backgroundColor = '#fef3c7'; // 노란색 배경
            row.style.borderLeft = '4px solid #f59e0b'; // 주황색 왼쪽 테두리
            row.classList.add('pending-edit-row');
        }
    };
    
    // 전역 디버깅 함수 추가
    window.debugInventory = function() {
        if (window.physicalInventoryAdmin) {
            window.physicalInventoryAdmin.debugInventoryState();
        } else {
            console.log('PhysicalInventoryAdmin 인스턴스가 없습니다.');
        }
    };
}); 