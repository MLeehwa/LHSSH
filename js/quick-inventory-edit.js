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
        const validChanges = Array.from(this.changes.entries()).filter(([_, change]) =>
            change.newStock !== undefined && change.newStock !== ''
        );

        if (validChanges.length === 0) return;

        this.hideConfirmModal();
        document.getElementById('loadingIndicator').classList.remove('hidden');

        try {
            const today = new Date().toISOString().split('T')[0];
            const globalMemo = document.getElementById('globalMemo')?.value?.trim() || '';
            let successCount = 0;
            let errorCount = 0;

            for (const [partNumber, change] of validChanges) {
                const item = this.inventory.find(i => i.part_number === partNumber);
                const currentStock = item?.current_stock || 0;
                const diff = change.newStock - currentStock;

                // 1. 재고 업데이트
                const { error: updateError } = await this.supabase
                    .from('inventory')
                    .update({
                        current_stock: change.newStock,
                        last_updated: new Date().toISOString()
                    })
                    .eq('part_number', partNumber);

                if (updateError) {
                    console.error(`재고 업데이트 오류 (${partNumber}):`, updateError);
                    errorCount++;
                    continue;
                }

                // 2. 거래 내역 기록 (일괄 조정 사유 사용)
                const transactionData = {
                    transaction_date: today,
                    part_number: partNumber,
                    transaction_type: 'ADJUSTMENT',
                    quantity: Math.abs(diff),
                    reference_id: `ADJ-${Date.now()}`,
                    notes: globalMemo || `실사 조정: ${currentStock} → ${change.newStock}`
                };

                const { error: transactionError } = await this.supabase
                    .from('inventory_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn(`거래 내역 기록 오류 (${partNumber}):`, transactionError);
                    // 거래 내역 오류는 무시 (재고는 이미 업데이트됨)
                }

                successCount++;
            }

            document.getElementById('loadingIndicator').classList.add('hidden');

            if (errorCount === 0) {
                this.showNotification(`${successCount}건의 재고가 성공적으로 수정되었습니다.`, 'success');
            } else {
                this.showNotification(`${successCount}건 성공, ${errorCount}건 실패`, 'warning');
            }

            // 변경사항 초기화 및 데이터 새로고침
            this.changes.clear();
            await this.loadInventoryData();

        } catch (error) {
            document.getElementById('loadingIndicator').classList.add('hidden');
            console.error('저장 중 오류:', error);
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
}

// 전역 노출
window.QuickInventoryEdit = QuickInventoryEdit;
