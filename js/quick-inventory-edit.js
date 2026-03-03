// Quick Inventory Edit - Excel 스타일 빠른 재고 편집
class QuickInventoryEdit {
    constructor() {
        this.inventory = [];
        this.filteredInventory = [];
        this.changes = new Map(); // part_number -> { newStock, memo }
        this.supabase = null;

        this.init();
    }

    async init() {
        this.initializeSupabase();
        this.bindEvents();
        await this.loadInventoryData();
    }

    initializeSupabase() {
        try {
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
                console.log('전역 Supabase 클라이언트 사용');
            } else if (typeof supabase !== 'undefined') {
                this.supabase = supabase.createClient(
                    'https://vzemucykhxlxgjuldibf.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ'
                );
                console.log('새 Supabase 클라이언트 생성');
            } else {
                console.error('Supabase 라이브러리가 로드되지 않았습니다.');
            }
        } catch (error) {
            console.error('Supabase 초기화 실패:', error);
        }
    }

    bindEvents() {
        // 새로고침 버튼
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            this.changes.clear();
            this.loadInventoryData();
        });

        // 저장 버튼
        document.getElementById('saveChangesBtn')?.addEventListener('click', () => {
            this.showConfirmModal();
        });

        // 검색 필터
        document.getElementById('searchFilter')?.addEventListener('input', (e) => {
            this.applyFilters();
        });

        // AS 제품 포함 체크박스
        document.getElementById('includeASCheckbox')?.addEventListener('change', () => {
            this.loadInventoryData();
        });

        // 변경된 항목만 보기
        document.getElementById('showModifiedOnly')?.addEventListener('change', () => {
            this.applyFilters();
        });

        // 모달 닫기
        document.getElementById('closeConfirmModal')?.addEventListener('click', () => {
            this.hideConfirmModal();
        });
        document.getElementById('cancelSave')?.addEventListener('click', () => {
            this.hideConfirmModal();
        });

        // 저장 확인
        document.getElementById('confirmSave')?.addEventListener('click', () => {
            this.saveChanges();
        });

        // document 레벨 붙여넣기 - 한 곳에서만 처리
        document.addEventListener('paste', (e) => {
            // 다른 입력 필드(메모, 검색 등)에서는 기본 동작 유지
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' && !activeElement.classList.contains('spreadsheet-input')) {
                return; // 기본 paste 동작
            }
            if (activeElement.tagName === 'TEXTAREA') {
                return; // 기본 paste 동작
            }

            // 테이블 영역이면 paste 처리
            const inventoryTable = document.getElementById('inventoryTable');
            if (inventoryTable) {
                this.handlePaste(e);
            }
        });
    }

    async loadInventoryData() {
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>데이터를 불러오는 중...</p>
                </td>
            </tr>
        `;

        try {
            // 이 메뉴에서 표시할 파트 목록 (고정)
            const targetPartNumbers = [
                '49560-DO000',
                '49560-L1250',
                '49560-P2600',
                '49560-P8600',
                '49560-P8650',
                '49560-R5210',
                '49600-P8000',
                '49600-P8020',
                '49600-R5000',
                '49601-P8000',
                '49601-R5000',
                '49560-DU000',
                '49560-DU050',
                '49560-S9420',
                '49560-S9480'
            ];

            // 재고 데이터 가져오기
            const { data: inventoryData, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('*')
                .in('part_number', targetPartNumbers)
                .order('part_number');

            if (inventoryError) {
                throw inventoryError;
            }

            // 목표 순서대로 정렬 (없는 파트는 current_stock 0으로 생성)
            this.inventory = targetPartNumbers.map(pn => {
                const existing = inventoryData?.find(item => item.part_number === pn);
                if (existing) {
                    return existing;
                } else {
                    // inventory에 없는 파트는 가상 데이터 생성
                    return {
                        part_number: pn,
                        current_stock: 0,
                        _isVirtual: true // 실제 DB에 없음 표시
                    };
                }
            });

            console.log('재고 데이터 로드 완료:', this.inventory.length);

            this.applyFilters();
            this.updateStats();

        } catch (error) {
            console.error('데이터 로드 오류:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>데이터 로드 중 오류가 발생했습니다.</p>
                        <p class="text-sm">${error.message}</p>
                    </td>
                </tr>
            `;
        }
    }

    applyFilters() {
        const searchFilter = document.getElementById('searchFilter')?.value?.toLowerCase() || '';
        const showModifiedOnly = document.getElementById('showModifiedOnly')?.checked || false;

        this.filteredInventory = this.inventory.filter(item => {
            const partNumber = (item.part_number || '').toLowerCase();
            const matchesSearch = !searchFilter || partNumber.includes(searchFilter);

            if (showModifiedOnly) {
                return matchesSearch && this.changes.has(item.part_number);
            }

            return matchesSearch;
        });

        this.renderTable();
    }

    renderTable() {
        console.log('[DEBUG] renderTable() 호출됨, 아이템 수:', this.filteredInventory.length);

        const tbody = document.getElementById('inventoryTableBody');

        if (this.filteredInventory.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-gray-500">
                        <i class="fas fa-search text-2xl mb-2"></i>
                        <p>조건에 맞는 데이터가 없습니다.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.filteredInventory.map((item, index) => {
            const partNumber = item.part_number;
            const currentStock = item.current_stock || 0;

            // 디버깅: 특정 파트 확인
            if (partNumber === '49560-DO000') {
                console.log('[DEBUG] 49560-DO000 렌더링:', currentStock);
            }

            const change = this.changes.get(partNumber);
            const newStock = change?.newStock ?? '';
            const diff = newStock !== '' ? newStock - currentStock : null;

            let diffClass = 'diff-zero';
            let diffText = '-';
            if (diff !== null) {
                if (diff > 0) {
                    diffClass = 'diff-positive';
                    diffText = `+${diff}`;
                } else if (diff < 0) {
                    diffClass = 'diff-negative';
                    diffText = `${diff}`;
                } else {
                    diffText = '0';
                }
            }

            const rowClass = change ? 'row-modified' : '';

            return `
                <tr class="${rowClass}" data-part-number="${partNumber}">
                    <td class="font-mono text-gray-800">${partNumber}</td>
                    <td class="text-right font-semibold text-gray-700">${currentStock.toLocaleString()}</td>
                    <td class="text-center">
                        <input type="number" 
                               class="spreadsheet-input text-center" 
                               data-part-number="${partNumber}"
                               data-current-stock="${currentStock}"
                               value="${newStock}"
                               placeholder="입력"
                               min="0"
                               step="1">
                    </td>
                    <td class="text-center ${diffClass}">${diffText}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;

        // 입력 이벤트 바인딩
        tbody.querySelectorAll('.spreadsheet-input').forEach(input => {
            input.addEventListener('input', (e) => this.handleStockInput(e));
            input.addEventListener('keydown', (e) => this.handleKeydown(e));
        });
    }

    handleStockInput(e) {
        const input = e.target;
        const partNumber = input.dataset.partNumber;
        const currentStock = parseInt(input.dataset.currentStock, 10);
        const newValue = input.value.trim();

        if (newValue === '') {
            // 값 삭제 시 변경 목록에서 제거
            const existing = this.changes.get(partNumber);
            if (existing) {
                if (existing.memo) {
                    this.changes.set(partNumber, { newStock: '', memo: existing.memo });
                } else {
                    this.changes.delete(partNumber);
                }
            }
        } else {
            const newStock = parseInt(newValue, 10);
            if (!isNaN(newStock) && newStock >= 0) {
                const existing = this.changes.get(partNumber) || {};
                this.changes.set(partNumber, {
                    newStock: newStock,
                    memo: existing.memo || '',
                    originalStock: currentStock
                });
            }
        }

        this.updateRowDisplay(partNumber);
        this.updateStats();
    }

    handleMemoInput(e) {
        const input = e.target;
        const partNumber = input.dataset.partNumber;
        const memo = input.value.trim();

        const existing = this.changes.get(partNumber);
        if (existing) {
            existing.memo = memo;
            this.changes.set(partNumber, existing);
        } else if (memo) {
            // 메모만 있고 수량 변경이 없는 경우는 변경으로 처리하지 않음
        }
    }

    handleKeydown(e) {
        const input = e.target;
        const allInputs = Array.from(document.querySelectorAll('.spreadsheet-input'));
        const currentIndex = allInputs.indexOf(input);

        // 화살표 키로 이동
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const nextInput = allInputs[currentIndex + 1];
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevInput = allInputs[currentIndex - 1];
            if (prevInput) {
                prevInput.focus();
                prevInput.select();
            }
        }
    }

    handlePaste(e) {
        const activeElement = document.activeElement;

        // 입력 필드가 아닌 곳에서 붙여넣기하면 전체 테이블 붙여넣기 시도
        const isInSpreadsheetInput = activeElement.classList.contains('spreadsheet-input');

        e.preventDefault();

        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const lines = pasteData.split(/[\r\n]+/).filter(line => line.trim());

        if (lines.length === 0) return;

        // 첫 번째 줄을 분석하여 모드 결정
        const firstLine = lines[0];
        const firstLineParts = firstLine.split(/\t/); // 탭으로 구분

        // 두 열 이상인 경우: 파트번호 + 재고수량 모드
        if (firstLineParts.length >= 2) {
            this.handleTwoColumnPaste(lines);
        } else if (isInSpreadsheetInput) {
            // 한 열만 있는 경우: 현재 셀부터 순차 입력 (기존 방식)
            this.handleSingleColumnPaste(lines, activeElement);
        } else {
            // 한 열만 있고 입력 필드가 아닌 경우: 첫 번째 입력부터 순차 입력
            const firstInput = document.querySelector('.spreadsheet-input');
            if (firstInput) {
                this.handleSingleColumnPaste(lines, firstInput);
            }
        }
    }

    // 두 열 붙여넣기 처리 (파트번호 + 재고수량)
    handleTwoColumnPaste(lines) {
        let matchedCount = 0;
        let unmatchedParts = [];

        lines.forEach(line => {
            const parts = line.split(/\t/);
            if (parts.length < 2) return;

            const partNumber = parts[0].trim();
            const stockValue = parts[1].trim();
            const numValue = parseInt(stockValue, 10);

            if (!partNumber || isNaN(numValue) || numValue < 0) return;

            // 해당 파트번호의 입력 필드 찾기
            const targetInput = document.querySelector(`.spreadsheet-input[data-part-number="${partNumber}"]`);

            if (targetInput) {
                targetInput.value = numValue;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                matchedCount++;
            } else {
                unmatchedParts.push(partNumber);
            }
        });

        if (matchedCount > 0) {
            this.showNotification(`${matchedCount}개 파트에 재고 값 붙여넣기 완료`, 'success');
        }

        if (unmatchedParts.length > 0) {
            console.warn('매칭되지 않은 파트번호:', unmatchedParts);
            if (unmatchedParts.length <= 5) {
                this.showNotification(`${unmatchedParts.length}개 파트번호가 목록에 없습니다: ${unmatchedParts.join(', ')}`, 'warning');
            } else {
                this.showNotification(`${unmatchedParts.length}개 파트번호가 목록에 없습니다`, 'warning');
            }
        }
    }

    // 단일 열 붙여넣기 처리 (재고수량만)
    handleSingleColumnPaste(lines, startElement) {
        const allInputs = Array.from(document.querySelectorAll('.spreadsheet-input'));
        const startIndex = allInputs.indexOf(startElement);

        let pastedCount = 0;
        lines.forEach((line, i) => {
            const targetInput = allInputs[startIndex + i];
            if (targetInput) {
                // 콤마 제거 후 파싱 (3,500 -> 3500)
                const value = line.trim().replace(/,/g, '');
                const numValue = parseInt(value, 10);

                if (!isNaN(numValue) && numValue >= 0) {
                    targetInput.value = numValue;
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    pastedCount++;
                }
            }
        });

        if (pastedCount > 0) {
            this.showNotification(`${pastedCount}개 값 붙여넣기 완료`, 'success');
        }
    }

    updateRowDisplay(partNumber) {
        const row = document.querySelector(`tr[data-part-number="${partNumber}"]`);
        if (!row) return;

        const change = this.changes.get(partNumber);
        const input = row.querySelector('.spreadsheet-input');
        const currentStock = parseInt(input.dataset.currentStock, 10);
        const newStock = change?.newStock;

        const diffCell = row.cells[3];

        if (newStock !== undefined && newStock !== '') {
            const diff = newStock - currentStock;
            row.classList.add('row-modified');

            diffCell.classList.remove('diff-positive', 'diff-negative', 'diff-zero');

            if (diff > 0) {
                diffCell.classList.add('diff-positive');
                diffCell.textContent = `+${diff}`;
            } else if (diff < 0) {
                diffCell.classList.add('diff-negative');
                diffCell.textContent = `${diff}`;
            } else {
                diffCell.classList.add('diff-zero');
                diffCell.textContent = '0';
            }
        } else {
            row.classList.remove('row-modified');
            diffCell.className = 'text-center diff-zero';
            diffCell.textContent = '-';
        }
    }

    updateStats() {
        // 실제 수량 변경이 있는 항목만 카운트
        const validChanges = Array.from(this.changes.entries()).filter(([_, change]) =>
            change.newStock !== undefined && change.newStock !== ''
        );

        document.getElementById('totalCount').textContent = this.inventory.length;
        document.getElementById('modifiedCount').textContent = validChanges.length;
        document.getElementById('changeCount').textContent = validChanges.length;

        const saveBtn = document.getElementById('saveChangesBtn');
        saveBtn.disabled = validChanges.length === 0;
    }

    showConfirmModal() {
        const validChanges = Array.from(this.changes.entries()).filter(([_, change]) =>
            change.newStock !== undefined && change.newStock !== ''
        );

        if (validChanges.length === 0) return;

        document.getElementById('confirmChangeCount').textContent = validChanges.length;

        const previewHtml = validChanges.map(([partNumber, change]) => {
            const item = this.inventory.find(i => i.part_number === partNumber);
            const currentStock = item?.current_stock || 0;
            const diff = change.newStock - currentStock;
            const diffClass = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500';
            const diffText = diff > 0 ? `+${diff}` : diff;

            return `
                <div class="flex items-center justify-between py-2 px-3 border-b border-gray-100 hover:bg-gray-50">
                    <span class="font-mono text-gray-800">${partNumber}</span>
                    <div class="flex items-center space-x-4">
                        <span class="text-gray-500">${currentStock}</span>
                        <i class="fas fa-arrow-right text-gray-400"></i>
                        <span class="font-semibold">${change.newStock}</span>
                        <span class="${diffClass} font-medium">(${diffText})</span>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('changePreview').innerHTML = previewHtml || '<p class="text-gray-500 text-center py-4">변경사항이 없습니다.</p>';
        document.getElementById('confirmModal').classList.remove('hidden');
    }

    hideConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    }

    async saveChanges() {
        console.log('[DEBUG] saveChanges() 함수 시작!');

        const validChanges = Array.from(this.changes.entries()).filter(([_, change]) =>
            change.newStock !== undefined && change.newStock !== ''
        );

        console.log('[DEBUG] 변경할 항목:', validChanges.length, '건');

        if (validChanges.length === 0) {
            console.warn('[DEBUG] 변경할 항목이 없습니다');
            return;
        }

        this.hideConfirmModal();
        document.getElementById('loadingIndicator').classList.remove('hidden');

        try {
            const today = window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0];
            const globalMemo = document.getElementById('globalMemo')?.value?.trim() || '';
            let successCount = 0;
            let errorCount = 0;

            console.log('[DEBUG] 오늘 날짜:', today);

            for (const [partNumber, change] of validChanges) {
                const item = this.inventory.find(i => i.part_number === partNumber);
                const currentStock = item?.current_stock || 0;
                const diff = change.newStock - currentStock;

                // 재고가 변경되지 않은 경우 스킵
                if (diff === 0) {
                    console.log(`재고 변경 없음 (${partNumber}): ${currentStock}`);
                    continue;
                }

                // 1. 재고 업데이트 (가상 파트면 INSERT, 아니면 UPDATE)
                console.log(`[DEBUG] 재고 업데이트 시도: ${partNumber} = ${change.newStock} (이전: ${currentStock})`);
                console.log(`[DEBUG] 가상 파트 여부: ${item?._isVirtual ? '예 (INSERT 필요)' : '아니오 (UPDATE 사용)'}`);

                let updateData, updateError;

                if (item?._isVirtual) {
                    // 새 파트: INSERT 사용
                    const result = await this.supabase
                        .from('inventory')
                        .insert({
                            part_number: partNumber,
                            current_stock: change.newStock,
                            last_updated: new Date().toISOString(),
                            min_stock: 0,
                            max_stock: 0,
                            status: 'in_stock'
                        })
                        .select();
                    updateData = result.data;
                    updateError = result.error;
                } else {
                    // 기존 파트: UPDATE 사용 (UPSERT 대신)
                    const result = await this.supabase
                        .from('inventory')
                        .update({
                            current_stock: change.newStock,
                            last_updated: new Date().toISOString()
                        })
                        .eq('part_number', partNumber)
                        .select();
                    updateData = result.data;
                    updateError = result.error;
                }

                if (updateError) {
                    console.error(`[ERROR] 재고 업데이트 오류 (${partNumber}):`, updateError);
                    errorCount++;
                    continue;
                }

                // 🔍 UPDATE 결과 상세 확인
                if (!updateData || updateData.length === 0) {
                    console.error(`[ERROR] UPDATE는 성공했지만 데이터가 반환되지 않음 (${partNumber})`);
                    console.error('[ERROR] 이것은 RLS 정책이나 권한 문제일 수 있습니다!');
                    errorCount++;
                    continue;
                }

                console.log(`[SUCCESS] 재고 업데이트 성공 (${partNumber}):`, updateData);
                console.log(`[SUCCESS] 반환된 값: ${updateData[0].current_stock}`);

                // 🔍 검증: 실제로 DB에 저장되었는지 SELECT로 확인
                const { data: verifyData, error: verifyError } = await this.supabase
                    .from('inventory')
                    .select('current_stock')
                    .eq('part_number', partNumber)
                    .single();

                if (verifyError) {
                    console.error(`[ERROR] 검증 SELECT 실패 (${partNumber}):`, verifyError);
                } else {
                    console.log(`[VERIFY] DB 실제 값: ${verifyData.current_stock}, 기대값: ${change.newStock}`);
                    if (verifyData.current_stock !== change.newStock) {
                        console.error(`[ERROR] 저장 검증 실패! DB: ${verifyData.current_stock}, 기대: ${change.newStock}`);
                        errorCount++;
                        continue;
                    } else {
                        console.log(`[VERIFY] ✅ 저장 검증 성공!`);
                    }
                }

                // 🚀 로컬 inventory 배열도 즉시 업데이트 (성능 최적화)
                const inventoryItem = this.inventory.find(i => i.part_number === partNumber);
                if (inventoryItem) {
                    inventoryItem.current_stock = change.newStock;
                    inventoryItem.last_updated = new Date().toISOString();
                    inventoryItem._isVirtual = false; // 이제 실제 DB에 존재함
                    console.log(`[DEBUG] 로컬 데이터 업데이트 완료: ${partNumber} = ${change.newStock}`);
                } else {
                    console.warn(`[WARN] 로컬 배열에서 ${partNumber}를 찾을 수 없음`);
                }

                // 2. 거래 내역 기록
                const transactionData = {
                    transaction_date: today,
                    part_number: partNumber,
                    transaction_type: 'ADJUSTMENT',
                    quantity: diff, // 양수면 증가, 음수면 감소 (기록용)
                    reference_id: `ADJ-${Date.now()}`,
                    notes: globalMemo || `실사 조정: ${currentStock} → ${change.newStock}`
                };

                const { error: transactionError } = await this.supabase
                    .from('inventory_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn(`거래 내역 기록 오류 (${partNumber}):`, transactionError);
                } else {
                    console.log(`[SUCCESS] 거래 내역 기록 완료 (${partNumber})`);
                }

                // 3. daily_inventory_snapshot 업데이트 (입고/출고와 동일 패턴)
                try {
                    await this.supabase
                        .from('daily_inventory_snapshot')
                        .upsert({
                            snapshot_date: today,
                            part_number: partNumber,
                            closing_stock: change.newStock
                        }, { onConflict: 'snapshot_date,part_number' });
                    console.log(`[SUCCESS] 스냅샷 업데이트 완료 (${partNumber})`);
                } catch (snapshotErr) {
                    console.warn(`daily_inventory_snapshot 업데이트 오류 (${partNumber}):`, snapshotErr);
                }

                successCount++;
            }

            document.getElementById('loadingIndicator').classList.add('hidden');

            if (errorCount === 0) {
                this.showNotification(`${successCount}건의 재고가 성공적으로 수정되었습니다.`, 'success');
            } else {
                this.showNotification(`${successCount}건 성공, ${errorCount}건 실패`, 'warning');
            }

            // 변경사항 초기화
            this.changes.clear();

            // 🚀 성능 최적화: 전체 데이터를 다시 불러오지 않고 화면만 업데이트
            console.log('[DEBUG] 화면 렌더링만 업데이트...');
            this.renderTable();
            this.updateStats();
            console.log('[DEBUG] saveChanges() 함수 완료!');

        } catch (error) {
            document.getElementById('loadingIndicator').classList.add('hidden');
            console.error('[ERROR] 저장 중 오류:', error);
            this.showNotification('저장 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // 간단한 알림 표시
        const bgColor = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        }[type] || 'bg-blue-500';

        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ============ 디버깅/테스트 함수들 ============

    /**
     * Supabase 연결 테스트
     * 콘솔에서: quickInventoryEdit.testConnection()
     */
    async testConnection() {
        console.log('========== Supabase 연결 테스트 ==========');

        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 없습니다!');
            return false;
        }

        console.log('✅ Supabase 클라이언트 존재함');

        try {
            // 1. 읽기 테스트
            console.log('\n📖 [1/3] 읽기 테스트 (SELECT)...');
            const { data: readData, error: readError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock')
                .limit(3);

            if (readError) {
                console.error('❌ 읽기 실패:', readError);
            } else {
                console.log('✅ 읽기 성공:', readData);
            }

            // 2. 테이블 구조 확인
            console.log('\n📋 [2/3] 테이블 구조 확인...');
            const { data: schemaData, error: schemaError } = await this.supabase
                .from('inventory')
                .select('*')
                .limit(1);

            if (schemaError) {
                console.error('❌ 스키마 확인 실패:', schemaError);
            } else if (schemaData && schemaData[0]) {
                console.log('✅ inventory 테이블 컬럼들:', Object.keys(schemaData[0]));
            }

            // 3. 특정 파트 확인
            console.log('\n🔍 [3/3] 특정 파트 확인 (49560-DO000)...');
            const { data: partData, error: partError } = await this.supabase
                .from('inventory')
                .select('*')
                .eq('part_number', '49560-DO000')
                .single();

            if (partError) {
                console.error('❌ 파트 조회 실패:', partError);
                console.log('   → 이 파트가 inventory 테이블에 없을 수 있습니다!');
            } else {
                console.log('✅ 파트 데이터:', partData);
            }

            console.log('\n========== 연결 테스트 완료 ==========');
            return true;

        } catch (error) {
            console.error('❌ 테스트 중 예외 발생:', error);
            return false;
        }
    }

    /**
     * RLS 정책 테스트 (실제 UPDATE 시도)
     * 콘솔에서: quickInventoryEdit.testRLS('49560-DO000', 100)
     */
    async testRLS(partNumber = '49560-DO000', testValue = 9999) {
        console.log('========== RLS 정책 테스트 ==========');
        console.log(`파트: ${partNumber}, 테스트 값: ${testValue}`);

        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 없습니다!');
            return;
        }

        try {
            // 1. 현재 값 확인
            console.log('\n📖 [1/4] 현재 값 확인...');
            const { data: beforeData, error: beforeError } = await this.supabase
                .from('inventory')
                .select('*')
                .eq('part_number', partNumber)
                .single();

            if (beforeError) {
                console.error('❌ 현재 값 조회 실패:', beforeError);
                console.log('   → 이 파트가 inventory 테이블에 존재하지 않습니다!');
                console.log('   → 먼저 INSERT가 필요할 수 있습니다.');
                return;
            }

            console.log('현재 데이터:', beforeData);
            const originalStock = beforeData.current_stock;

            // 2. UPDATE 시도
            console.log('\n✏️ [2/4] UPDATE 시도...');
            const { data: updateData, error: updateError, status, statusText } = await this.supabase
                .from('inventory')
                .update({
                    current_stock: testValue,
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber)
                .select();

            console.log('   HTTP Status:', status, statusText);

            if (updateError) {
                console.error('❌ UPDATE 실패:', updateError);
                console.log('\n⚠️ RLS 정책이 UPDATE를 차단하고 있을 수 있습니다!');
                console.log('   해결 방법: Supabase 대시보드 > Authentication > Policies 에서');
                console.log('   inventory 테이블에 "Allow public update" 정책을 추가하세요.');
                return;
            }

            if (!updateData || updateData.length === 0) {
                console.error('❌ UPDATE는 성공했지만 데이터가 반환되지 않음!');
                console.log('\n⚠️ 이것은 RLS 정책 문제입니다!');
                console.log('   UPDATE 쿼리는 실행되었지만 WHERE 조건에 맞는 행이 없거나');
                console.log('   RLS 정책에 의해 접근이 차단되었습니다.');
                return;
            }

            console.log('✅ UPDATE 성공:', updateData);

            // 3. 변경 확인
            console.log('\n🔍 [3/4] 변경 확인...');
            const { data: afterData, error: afterError } = await this.supabase
                .from('inventory')
                .select('*')
                .eq('part_number', partNumber)
                .single();

            if (afterError) {
                console.error('❌ 변경 확인 실패:', afterError);
            } else {
                console.log('변경 후 데이터:', afterData);

                if (afterData.current_stock === testValue) {
                    console.log('✅ 데이터베이스에 정상적으로 저장됨!');
                } else {
                    console.error('❌ 값이 변경되지 않음! DB: ', afterData.current_stock, '기대값:', testValue);
                }
            }

            // 4. 원래 값으로 복원
            console.log('\n🔄 [4/4] 원래 값으로 복원...');
            const { error: restoreError } = await this.supabase
                .from('inventory')
                .update({
                    current_stock: originalStock,
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber);

            if (restoreError) {
                console.error('❌ 복원 실패:', restoreError);
            } else {
                console.log('✅ 원래 값으로 복원 완료:', originalStock);
            }

            console.log('\n========== RLS 테스트 완료 ==========');

        } catch (error) {
            console.error('❌ 테스트 중 예외 발생:', error);
        }
    }

    /**
     * RLS 정책 상태 확인 (Service Role Key 없이는 제한적)
     */
    async checkRLSStatus() {
        console.log('========== RLS 상태 확인 ==========');
        console.log('⚠️ 클라이언트에서는 RLS 정책을 직접 확인할 수 없습니다.');
        console.log('\n📋 Supabase 대시보드에서 확인하세요:');
        console.log('   1. https://supabase.com/dashboard 로그인');
        console.log('   2. 프로젝트 선택');
        console.log('   3. Table Editor > inventory 테이블 선택');
        console.log('   4. 우측 상단 "RLS" 버튼 클릭');
        console.log('\n🔧 익명 사용자도 UPDATE 가능하게 하려면:');
        console.log('   SQL Editor에서 다음 실행:');
        console.log('   ----------------------------------------');
        console.log('   -- 기존 RLS 정책 삭제 (있다면)');
        console.log('   DROP POLICY IF EXISTS "Allow update for authenticated users" ON inventory;');
        console.log('');
        console.log('   -- 모든 사용자 UPDATE 허용');
        console.log('   CREATE POLICY "Allow public update" ON inventory');
        console.log('       FOR UPDATE USING (true) WITH CHECK (true);');
        console.log('');
        console.log('   -- 모든 사용자 INSERT 허용 (필요시)');
        console.log('   CREATE POLICY "Allow public insert" ON inventory');
        console.log('       FOR INSERT WITH CHECK (true);');
        console.log('   ----------------------------------------');
    }
}

// 전역 노출
window.QuickInventoryEdit = QuickInventoryEdit;
