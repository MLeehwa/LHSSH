// 초기 재고 설정 JavaScript
class InitialInventorySetup {
    constructor() {
        this.supabase = null;
        this.initialStockData = [];
        this.parts = [];
        this.referenceDate = null; // 기준 날짜
    }

    async init() {
        this.initializeSupabase();
        this.setupEventListeners();
        this.updateCurrentTime();
        this.setDefaultDate();
        
        // Supabase가 초기화된 후 파트 로드
        if (this.supabase) {
            await this.loadParts();
        }
        
        console.log('✅ 초기 재고 설정 초기화 완료');
    }

    setDefaultDate() {
        // 기본 날짜를 어제로 설정
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split('T')[0];
        
        document.getElementById('referenceDate').value = yesterdayString;
        document.getElementById('manualReferenceDate').value = yesterdayString;
        this.referenceDate = yesterdayString;
        
        console.log('기본 날짜 설정:', yesterdayString);
    }

    initializeSupabase() {
        if (typeof window.partService !== 'undefined') {
            this.supabase = window.partService.supabase;
        } else {
            console.error('❌ Supabase가 로드되지 않았습니다.');
            this.showError('Supabase 연결에 실패했습니다.');
        }
    }

    async loadParts() {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .select('*')
                .eq('status', 'ACTIVE')
                .order('part_number');

            if (error) throw error;

            this.parts = data || [];
            this.updatePartSelect();
            console.log('✅ 파트 목록 로드 완료:', this.parts.length + '개');
        } catch (error) {
            console.error('❌ 파트 목록 로드 실패:', error);
            this.showError('파트 목록을 불러오는데 실패했습니다.');
        }
    }

    updatePartSelect() {
        const partSelect = document.getElementById('partSelect');
        partSelect.innerHTML = `<option value="">${i18n.t('select_part_manual')}</option>`;
        
        this.parts.forEach(part => {
            const option = document.createElement('option');
            option.value = part.part_number;
            option.textContent = `${part.part_number} (${part.category})`;
            partSelect.appendChild(option);
        });
    }

    setupEventListeners() {
        // CSV 업로드
        document.getElementById('uploadCsvBtn').addEventListener('click', () => {
            this.handleCsvUpload();
        });

        // 템플릿 다운로드
        document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
            this.downloadTemplate();
        });

        // 수동 입력 추가
        document.getElementById('addInitialStockBtn').addEventListener('click', () => {
            this.addInitialStock();
        });

        // 전체 삭제
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllStock();
        });

        // 초기 재고 저장
        document.getElementById('saveInitialStockBtn').addEventListener('click', () => {
            this.saveInitialStock();
        });

        // Enter 키로 추가
        document.getElementById('initialStock').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addInitialStock();
            }
        });

        // 날짜 선택 이벤트
        document.getElementById('referenceDate').addEventListener('change', (e) => {
            this.referenceDate = e.target.value;
            console.log('CSV 기준 날짜 설정:', this.referenceDate);
        });

        document.getElementById('manualReferenceDate').addEventListener('change', (e) => {
            this.referenceDate = e.target.value;
            console.log('수동 입력 기준 날짜 설정:', this.referenceDate);
        });
    }

    async handleCsvUpload() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];

        if (!file) {
            this.showError('CSV 파일을 선택해주세요.');
            return;
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('CSV 파일만 업로드 가능합니다.');
            return;
        }

        this.showLoading();

        try {
            const text = await this.readFileAsText(file);
            const csvData = this.parseCSV(text);
            
            if (csvData.length === 0) {
                throw new Error('CSV 파일이 비어있습니다.');
            }

            // CSV 데이터 검증 및 변환
            const validData = this.validateCsvData(csvData);
            
            if (validData.length === 0) {
                throw new Error('유효한 데이터가 없습니다.');
            }

            // 기존 데이터에 추가
            this.initialStockData = [...this.initialStockData, ...validData];
            this.renderInitialStockTable();
            
            this.hideLoading();
            this.showSuccess(`${validData.length}개의 초기 재고 데이터가 추가되었습니다.`);
            
            // 파일 입력 초기화
            fileInput.value = '';

        } catch (error) {
            this.hideLoading();
            console.error('❌ CSV 업로드 실패:', error);
            this.showError('CSV 업로드 실패: ' + error.message);
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });
    }

    validateCsvData(csvData) {
        const validData = [];
        const requiredColumns = ['part_number', 'initial_stock'];

        csvData.forEach((row, index) => {
            try {
                // 필수 컬럼 확인
                const hasRequiredColumns = requiredColumns.every(col => 
                    row[col] !== undefined && row[col] !== ''
                );

                if (!hasRequiredColumns) {
                    console.warn(`행 ${index + 2}: 필수 컬럼이 누락되었습니다.`);
                    return;
                }

                // 파트 번호 존재 확인
                const part = this.parts.find(p => p.part_number === row.part_number);
                if (!part) {
                    console.warn(`행 ${index + 2}: 존재하지 않는 파트 번호입니다: ${row.part_number}`);
                    return;
                }

                // 재고 수량 검증
                const stock = parseInt(row.initial_stock);
                if (isNaN(stock) || stock < 0) {
                    console.warn(`행 ${index + 2}: 유효하지 않은 재고 수량입니다: ${row.initial_stock}`);
                    return;
                }

                // 중복 확인
                const existingIndex = this.initialStockData.findIndex(item => 
                    item.part_number === row.part_number
                );
                
                if (existingIndex >= 0) {
                    // 기존 데이터 업데이트
                    this.initialStockData[existingIndex].initial_stock = stock;
                } else {
                    // 새 데이터 추가
                    validData.push({
                        part_number: row.part_number,
                        category: part.category,
                        initial_stock: stock
                    });
                }

            } catch (error) {
                console.warn(`행 ${index + 2}: 데이터 처리 중 오류 발생:`, error);
            }
        });

        return validData;
    }

    downloadTemplate() {
        const headers = ['part_number', 'initial_stock'];
        const sampleData = [
            ['INNER-001', '100'],
            ['REAR-001', '50'],
            ['INNER-002', '75']
        ];

        let csvContent = headers.join(',') + '\n';
        csvContent += sampleData.map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'initial_inventory_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    addInitialStock() {
        const partSelect = document.getElementById('partSelect');
        const initialStockInput = document.getElementById('initialStock');

        const partNumber = partSelect.value;
        const stock = parseInt(initialStockInput.value);

        if (!partNumber) {
            this.showError('파트를 선택해주세요.');
            return;
        }

        if (isNaN(stock) || stock < 0) {
            this.showError('유효한 재고 수량을 입력해주세요.');
            return;
        }

        const part = this.parts.find(p => p.part_number === partNumber);
        if (!part) {
            this.showError('선택한 파트를 찾을 수 없습니다.');
            return;
        }

        // 중복 확인
        const existingIndex = this.initialStockData.findIndex(item => 
            item.part_number === partNumber
        );

        if (existingIndex >= 0) {
            // 기존 데이터 업데이트
            this.initialStockData[existingIndex].initial_stock = stock;
        } else {
            // 새 데이터 추가
            this.initialStockData.push({
                part_number: partNumber,
                category: part.category,
                initial_stock: stock
            });
        }

        this.renderInitialStockTable();
        
        // 입력 필드 초기화
        partSelect.value = '';
        initialStockInput.value = '';

        this.showSuccess('초기 재고가 추가되었습니다.');
    }

    renderInitialStockTable() {
        const tbody = document.getElementById('initialStockTableBody');
        const emptyState = document.getElementById('emptyState');

        if (this.initialStockData.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        tbody.innerHTML = '';

        this.initialStockData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.part_number}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.category === 'INNER' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }">
                        ${item.category}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.initial_stock.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="initialInventorySetup.removeStock(${index})" 
                            class="text-red-600 hover:text-red-900 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    removeStock(index) {
        this.initialStockData.splice(index, 1);
        this.renderInitialStockTable();
        this.showSuccess('초기 재고가 삭제되었습니다.');
    }

    clearAllStock() {
        if (this.initialStockData.length === 0) {
            this.showError('삭제할 데이터가 없습니다.');
            return;
        }

        if (confirm(i18n.t('confirm_delete_all'))) {
            this.initialStockData = [];
            this.renderInitialStockTable();
            this.showSuccess('모든 초기 재고 데이터가 삭제되었습니다.');
        }
    }

    async saveInitialStock() {
        if (this.initialStockData.length === 0) {
            this.showError('저장할 초기 재고 데이터가 없습니다.');
            return;
        }

        if (!this.referenceDate) {
            this.showError('기준 날짜를 선택해주세요.');
            return;
        }

        this.showLoading();

        try {
            console.log('=== 초기 재고 저장 시작 ===');
            console.log('기준 날짜:', this.referenceDate);
            console.log('처리할 파트 수:', this.initialStockData.length);

            // 1. 선택한 날짜의 daily_inventory_summary에서 마감 재고 조회
            const { data: dailySummary, error: summaryError } = await this.supabase
                .from('daily_inventory_summary')
                .select('part_number, current_stock')
                .eq('summary_date', this.referenceDate);

            if (summaryError) {
                console.warn('daily_inventory_summary 조회 실패, 기본 재고로 설정:', summaryError);
            }

            console.log('조회된 daily_inventory_summary:', dailySummary);

            // 2. 기존 inventory 데이터 삭제
            const { error: deleteError } = await this.supabase
                .from('inventory')
                .delete()
                .neq('part_number', ''); // 모든 데이터 삭제

            if (deleteError) throw deleteError;

            // 3. 새로운 초기 재고 데이터 생성
            const inventoryData = this.initialStockData.map(item => {
                // daily_inventory_summary에서 해당 파트의 마감 재고 찾기
                const summaryItem = dailySummary?.find(s => s.part_number === item.part_number);
                const finalStock = summaryItem ? summaryItem.current_stock : item.initial_stock;
                
                console.log(`파트 ${item.part_number}: CSV=${item.initial_stock}, 마감재고=${summaryItem?.current_stock || 'N/A'}, 최종=${finalStock}`);
                
                return {
                    part_number: item.part_number,
                    current_stock: finalStock,
                    status: 'in_stock',
                    last_updated: new Date().toISOString()
                };
            });

            // 4. inventory 테이블에 삽입
            const { error: insertError } = await this.supabase
                .from('inventory')
                .insert(inventoryData);

            if (insertError) throw insertError;

            // 5. 거래 내역 초기화
            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .delete()
                .neq('part_number', '');

            if (transactionError) throw transactionError;

            // 6. 선택한 날짜의 daily_inventory_summary 생성 (초기 재고 상태 반영)
            console.log('선택한 날짜의 daily_inventory_summary 생성 중...');
            console.log('기준 날짜:', this.referenceDate);
            
            const { error: generateError } = await this.supabase.rpc('generate_daily_inventory_summary', {
                target_date: this.referenceDate
            });

            if (generateError) {
                console.warn('daily_inventory_summary 생성 실패:', generateError);
            } else {
                console.log(`daily_inventory_summary 생성 완료 (기준 날짜: ${this.referenceDate})`);
            }

            this.hideLoading();
            this.showSuccess(`초기 재고가 성공적으로 설정되었습니다. (${this.initialStockData.length}개 파트, 기준: ${this.referenceDate})`);
            
            // 데이터 초기화
            this.initialStockData = [];
            this.renderInitialStockTable();

        } catch (error) {
            this.hideLoading();
            console.error('❌ 초기 재고 저장 실패:', error);
            this.showError('초기 재고 저장 실패: ' + error.message);
        }
    }

    showLoading() {
        document.getElementById('loadingModal').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingModal').style.display = 'none';
    }

    showSuccess(message) {
        const modal = document.getElementById('successModal');
        const messageElement = modal.querySelector('p');
        messageElement.textContent = message;
        modal.style.display = 'flex';
    }

    showError(message) {
        const modal = document.getElementById('errorModal');
        const messageElement = document.getElementById('errorMessage');
        messageElement.textContent = message;
        modal.style.display = 'flex';
    }

    closeSuccessModal() {
        document.getElementById('successModal').style.display = 'none';
    }

    closeErrorModal() {
        document.getElementById('errorModal').style.display = 'none';
    }

    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('currentTime').textContent = timeString;
    }

    logout() {
        if (confirm(i18n.t('confirm_logout'))) {
            window.location.href = '../login.html';
        }
    }
}

// 전역 함수들
function closeSuccessModal() {
    initialInventorySetup.closeSuccessModal();
}

function closeErrorModal() {
    initialInventorySetup.closeErrorModal();
}

function logout() {
    initialInventorySetup.logout();
}

// 페이지 로드 시 초기화
let initialInventorySetup;
document.addEventListener('DOMContentLoaded', async () => {
    // config.js와 supabase-client.js가 로드될 때까지 대기
    const waitForDependencies = () => {
        return new Promise((resolve) => {
            const checkDependencies = () => {
                if (typeof window.getCurrentConfig !== 'undefined' && 
                    typeof window.partService !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkDependencies, 100);
                }
            };
            checkDependencies();
        });
    };

    try {
        await waitForDependencies();
        initialInventorySetup = new InitialInventorySetup();
        await initialInventorySetup.init();
        
        // 시간 업데이트
        setInterval(() => {
            initialInventorySetup.updateCurrentTime();
        }, 1000);
    } catch (error) {
        console.error('초기화 실패:', error);
    }
});
