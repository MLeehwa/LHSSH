// Inventory Status JavaScript - Performance Optimized
class InventoryStatus {
    constructor() {
        this.inventory = [];
        this.transactions = [];
        this.filteredInventory = [];
        this.filteredTransactions = [];
        this.filterTimeout = null;
        this.masterParts = [];
        
        // Performance optimizations
        this.cache = new Map();
        this.lastDataUpdate = 0;
        this.dataUpdateInterval = 30000; // 30 seconds
        this.isLoading = false;
        this.domCache = new Map();
        
        // Supabase 클라이언트 초기화
        this.initializeSupabase();
        
        this.init();
    }

    // Supabase 클라이언트 초기화
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
                throw new Error('Supabase 라이브러리가 로드되지 않았습니다.');
            }
            console.log('Supabase 클라이언트 초기화 성공');
        } catch (error) {
            console.error('Supabase 클라이언트 초기화 실패:', error);
        }
    }

    async init() {
        await this.loadData();
        this.bindEvents();
        this.updateStats();
        this.updateCurrentTime();
        
        // Performance: Use requestAnimationFrame for time updates
        this.scheduleTimeUpdate();
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
        const container = document.getElementById('inventoryStatusContainer') || document.body;
        
        // Single event listener for all filter interactions
        container.addEventListener('input', (e) => {
            if (e.target.matches('#partNumberFilter')) {
                this.debouncedApplyFilters();
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target.matches('#dateFilter, #stockFilter')) {
                this.applyFilters();
            }
        });

        container.addEventListener('click', (e) => {
            // Filter buttons
            if (e.target.matches('#applyFilter')) {
                this.applyFilters();
            } else if (e.target.matches('#resetFilter')) {
                this.resetFilters();
            } else if (e.target.matches('#refreshDataBtn')) {
                this.refreshData();
            } else if (e.target.matches('#csvUploadBtn')) {
                this.showCsvUploadModal();
            } else if (e.target.matches('#manualInboundBtn')) {
                this.showManualInboundModal();
            } else if (e.target.matches('#exportBtn')) {
                this.toggleExportDropdown();
            } else if (e.target.matches('#exportCSVBtn')) {
                this.exportData('csv');
                this.hideExportDropdown();
            } else if (e.target.matches('#exportExcelBtn')) {
                this.exportData('excel');
                this.hideExportDropdown();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#exportBtn')) {
                this.hideExportDropdown();
            }
        });

        // CSV upload modal events
        this.bindModalEvents();
        
        // Performance: Setup drag and drop once
        this.setupDragAndDrop();
    }

    bindModalEvents() {
        const modalEvents = [
            { selector: '#cancelCsvUpload, #cancelCsvUploadBtn', action: () => this.closeCsvUploadModal() },
            { selector: '#selectCsvFile', action: () => document.getElementById('csvFileInput').click() },
            { selector: '#removeFile', action: () => this.removeSelectedFile() },
            { selector: '#uploadCsv', action: () => this.uploadFileData() },
            { selector: '#cancelManualInbound, #cancelManualInboundBtn', action: () => this.closeManualInboundModal() },
            { selector: '#addPartBtn', action: () => this.addPartField() }
        ];

        modalEvents.forEach(({ selector, action }) => {
            document.addEventListener('click', (e) => {
                if (e.target.matches(selector)) {
                    action();
                }
            });
        });

        // Form submission
        document.addEventListener('submit', (e) => {
            if (e.target.matches('#manualInboundForm')) {
                e.preventDefault();
                this.submitManualInbound();
            }
        });

        // File input change
        document.addEventListener('change', (e) => {
            if (e.target.matches('#csvFileInput')) {
                this.handleFileSelect(e);
            }
        });
    }

    toggleExportDropdown() {
        const dropdown = document.getElementById('exportDropdown');
        dropdown.classList.toggle('hidden');
    }

    hideExportDropdown() {
        const dropdown = document.getElementById('exportDropdown');
        dropdown.classList.add('hidden');
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
            
            if (!this.supabase) {
                console.warn('Supabase 클라이언트가 초기화되지 않았습니다. 모의 데이터를 사용합니다.');
                this.loadMockData();
                return;
            }
            
            // Performance: Load data in parallel
            const [inventoryResult, transactionResult] = await Promise.all([
                this.loadInventoryData(),
                this.loadTransactionData()
            ]);
            
            this.inventory = inventoryResult;
            this.transactions = transactionResult;
            
            this.filteredInventory = [...this.inventory];
            this.filteredTransactions = [...this.transactions];
            
            this.lastDataUpdate = now;
            this.cache.clear(); // Clear old cache
            
            console.log('데이터 로드 완료. 총 재고:', this.inventory.length, '총 거래:', this.transactions.length);
            
            this.renderInventory();
            this.renderTransactions();
            
        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            this.loadMockData();
        } finally {
            this.isLoading = false;
        }
    }

    async loadInventoryData() {
        const cacheKey = 'inventory_data';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data: inventoryData, error: inventoryError } = await this.supabase
            .from('inventory')
            .select('*')
            .order('part_number');
        
        if (inventoryError) {
            console.error('재고 데이터 로드 오류:', inventoryError);
            return this.getMockInventory();
        }
        
        const result = inventoryData || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    async loadTransactionData() {
        const cacheKey = 'transaction_data';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data: transactionData, error: transactionError } = await this.supabase
            .from('inventory_transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(100);
        
        if (transactionError) {
            console.error('거래 내역 데이터 로드 오류:', transactionError);
            return this.getMockTransactions();
        }
        
        const result = transactionData || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    loadMockData() {
        this.inventory = this.getMockInventory();
        this.transactions = this.getMockTransactions();
        this.filteredInventory = [...this.inventory];
        this.filteredTransactions = [...this.transactions];
        this.renderInventory();
        this.renderTransactions();
    }

    getMockInventory() {
        return [
            {
                id: 1,
                partNumber: '49560-12345',
                currentStock: 150,
                minStock: 50,
                todayInbound: 48,
                todayOutbound: 25,
                lastUpdated: '2024-01-15 14:30:00',
                status: 'in_stock'
            },
            {
                id: 2,
                partNumber: '49560-67890',
                currentStock: 80,
                minStock: 100,
                todayInbound: 60,
                todayOutbound: 40,
                lastUpdated: '2024-01-15 15:45:00',
                status: 'low_stock'
            },
            {
                id: 3,
                partNumber: '49600-11111',
                currentStock: 0,
                minStock: 30,
                todayInbound: 0,
                todayOutbound: 37,
                lastUpdated: '2024-01-15 16:20:00',
                status: 'out_of_stock'
            },
            {
                id: 4,
                partNumber: '49560-22222',
                currentStock: 200,
                minStock: 80,
                todayInbound: 70,
                todayOutbound: 0,
                lastUpdated: '2024-01-15 17:10:00',
                status: 'in_stock'
            },
            {
                id: 5,
                partNumber: '49601-33333',
                currentStock: 45,
                minStock: 50,
                todayInbound: 30,
                todayOutbound: 15,
                lastUpdated: '2024-01-15 18:00:00',
                status: 'low_stock'
            },
            {
                id: 6,
                partNumber: '49560-44444',
                currentStock: 120,
                minStock: 60,
                todayInbound: 75,
                todayOutbound: 20,
                lastUpdated: '2024-01-15 19:15:00',
                status: 'in_stock'
            },
            {
                id: 7,
                partNumber: '49600-55555',
                currentStock: 25,
                minStock: 40,
                todayInbound: 40,
                todayOutbound: 35,
                lastUpdated: '2024-01-15 20:30:00',
                status: 'low_stock'
            },
            {
                id: 8,
                partNumber: '49560-66666',
                currentStock: 180,
                minStock: 70,
                todayInbound: 35,
                todayOutbound: 10,
                lastUpdated: '2024-01-15 21:45:00',
                status: 'in_stock'
            }
        ];
    }

    getMockTransactions() {
        return [
            {
                id: 1,
                date: '2024-01-15',
                partNumber: '49560-12345',
                type: 'INBOUND',
                quantity: 48,
                balanceAfter: 150,
                referenceNumber: 'IN-2024-001-001'
            },
            {
                id: 2,
                date: '2024-01-15',
                partNumber: '49560-12345',
                type: 'OUTBOUND',
                quantity: 25,
                balanceAfter: 125,
                referenceNumber: 'OUT-2024-001-001'
            },
            {
                id: 3,
                date: '2024-01-15',
                partNumber: '49560-67890',
                type: 'INBOUND',
                quantity: 60,
                balanceAfter: 140,
                referenceNumber: 'IN-2024-001-002'
            },
            {
                id: 4,
                date: '2024-01-15',
                partNumber: '49560-67890',
                type: 'OUTBOUND',
                quantity: 40,
                balanceAfter: 100,
                referenceNumber: 'OUT-2024-001-002'
            },
            {
                id: 5,
                date: '2024-01-15',
                partNumber: '49600-11111',
                type: 'OUTBOUND',
                quantity: 37,
                balanceAfter: 0,
                referenceNumber: 'OUT-2024-001-003'
            },
            {
                id: 6,
                date: '2024-01-15',
                partNumber: '49560-22222',
                type: 'INBOUND',
                quantity: 70,
                balanceAfter: 200,
                referenceNumber: 'IN-2024-001-003'
            },
            {
                id: 7,
                date: '2024-01-15',
                partNumber: '49601-33333',
                type: 'INBOUND',
                quantity: 30,
                balanceAfter: 75,
                referenceNumber: 'IN-2024-001-004'
            },
            {
                id: 8,
                date: '2024-01-15',
                partNumber: '49601-33333',
                type: 'OUTBOUND',
                quantity: 15,
                balanceAfter: 60,
                referenceNumber: 'OUT-2024-001-004'
            },
            {
                id: 9,
                date: '2024-01-15',
                partNumber: '49560-44444',
                type: 'INBOUND',
                quantity: 75,
                balanceAfter: 195,
                referenceNumber: 'IN-2024-001-005'
            },
            {
                id: 10,
                date: '2024-01-15',
                partNumber: '49560-44444',
                type: 'OUTBOUND',
                quantity: 20,
                balanceAfter: 175,
                referenceNumber: 'OUT-2024-001-005'
            },
            // 주말 데이터 추가 (1월 20일은 토요일, 1월 21일은 일요일)
            {
                id: 11,
                date: '2024-01-20',
                partNumber: '49560-12345',
                type: 'INBOUND',
                quantity: 20,
                balanceAfter: 145,
                referenceNumber: 'IN-2024-001-006'
            },
            {
                id: 12,
                date: '2024-01-20',
                partNumber: '49560-12345',
                type: 'OUTBOUND',
                quantity: 10,
                balanceAfter: 135,
                referenceNumber: 'OUT-2024-001-006'
            },
            {
                id: 13,
                date: '2024-01-20',
                partNumber: '49560-67890',
                type: 'OUTBOUND',
                quantity: 15,
                balanceAfter: 85,
                referenceNumber: 'OUT-2024-001-007'
            },
            {
                id: 14,
                date: '2024-01-21',
                partNumber: '49560-22222',
                type: 'INBOUND',
                quantity: 25,
                balanceAfter: 225,
                referenceNumber: 'IN-2024-001-007'
            },
            {
                id: 15,
                date: '2024-01-21',
                partNumber: '49601-33333',
                type: 'OUTBOUND',
                quantity: 8,
                balanceAfter: 52,
                referenceNumber: 'OUT-2024-001-008'
            },
            {
                id: 16,
                date: '2024-01-21',
                partNumber: '49560-44444',
                type: 'INBOUND',
                quantity: 30,
                balanceAfter: 205,
                referenceNumber: 'IN-2024-001-008'
            },
            // 추가 주말 데이터 (1월 27일은 토요일, 1월 28일은 일요일)
            {
                id: 17,
                date: '2024-01-27',
                partNumber: '49560-12345',
                type: 'OUTBOUND',
                quantity: 12,
                balanceAfter: 123,
                referenceNumber: 'OUT-2024-001-009'
            },
            {
                id: 18,
                date: '2024-01-27',
                partNumber: '49560-67890',
                type: 'INBOUND',
                quantity: 18,
                balanceAfter: 103,
                referenceNumber: 'IN-2024-001-009'
            },
            {
                id: 19,
                date: '2024-01-28',
                partNumber: '49560-22222',
                type: 'OUTBOUND',
                quantity: 15,
                balanceAfter: 210,
                referenceNumber: 'OUT-2024-001-010'
            },
            {
                id: 20,
                date: '2024-01-28',
                partNumber: '49601-33333',
                type: 'INBOUND',
                quantity: 12,
                balanceAfter: 64,
                referenceNumber: 'IN-2024-001-010'
            }
        ];
    }

    debouncedApplyFilters() {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        
        this.filterTimeout = setTimeout(() => {
            this.applyFilters();
        }, 150); // Reduced from 300ms to 150ms for better responsiveness
    }

    applyFilters() {
        const partNumberFilter = document.getElementById('partNumberFilter').value.toLowerCase();
        const dateFilter = document.getElementById('dateFilter').value;
        const stockFilter = document.getElementById('stockFilter').value;

        // Performance: Use more efficient filtering
        this.filteredInventory = this.inventory.filter(item => {
            const partNumber = (item.part_number || item.partNumber || '').toLowerCase();
            const matchesPartNumber = !partNumberFilter || partNumber.includes(partNumberFilter);
            const matchesStock = !stockFilter || item.status === stockFilter;
            return matchesPartNumber && matchesStock;
        });

        this.filteredTransactions = this.transactions.filter(transaction => {
            const partNumber = (transaction.part_number || transaction.partNumber || '').toLowerCase();
            const transactionDate = transaction.date || transaction.created_at || '';
            const matchesPartNumber = !partNumberFilter || partNumber.includes(partNumberFilter);
            const matchesDate = !dateFilter || transactionDate === dateFilter;
            return matchesPartNumber && matchesDate;
        });

        // Performance: Batch DOM updates
        requestAnimationFrame(() => {
            this.renderInventory();
            this.renderTransactions();
            this.updateStats();
        });
    }

    resetFilters() {
        document.getElementById('partNumberFilter').value = '';
        document.getElementById('dateFilter').value = '';
        document.getElementById('stockFilter').value = '';

        this.filteredInventory = [...this.inventory];
        this.filteredTransactions = [...this.transactions];
        this.renderInventory();
        this.renderTransactions();
        this.updateStats();
        this.showNotification('필터가 초기화되었습니다.', 'info');
    }

    renderInventory() {
        const tbody = document.getElementById('inventoryTableBody');
        
        // Performance: Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        if (this.filteredInventory.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                    조건에 맞는 재고가 없습니다.
                </td>
            `;
            fragment.appendChild(noDataRow);
        } else {
            // Performance: Pre-compute status colors and texts
            const statusCache = new Map();
            
            this.filteredInventory.forEach(item => {
                const row = document.createElement('tr');
                
                // Cache status styling
                let statusColor, statusText;
                if (statusCache.has(item.status)) {
                    const cached = statusCache.get(item.status);
                    statusColor = cached.color;
                    statusText = cached.text;
                } else {
                    statusColor = this.getStockStatusColor(item.status);
                    statusText = this.getStockStatusText(item.status);
                    statusCache.set(item.status, { color: statusColor, text: statusText });
                }

                const partNumber = item.part_number || 'N/A';
                const currentStock = item.current_stock !== undefined ? item.current_stock : 0;
                const lastUpdated = item.last_updated || 'N/A';

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${partNumber}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${currentStock}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lastUpdated}</td>
                `;
                fragment.appendChild(row);
            });
        }
        
        // Performance: Single DOM update
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    renderTransactions() {
        const tbody = document.getElementById('transactionTableBody');
        
        // Performance: Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        if (this.filteredTransactions.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    조건에 맞는 일간 내역이 없습니다.
                </td>
            `;
            fragment.appendChild(noDataRow);
        } else {
            // Performance: Pre-compute type styling
            const typeCache = new Map();
            
            this.filteredTransactions.forEach(transaction => {
                const row = document.createElement('tr');
                
                // Cache type styling
                let typeColor, typeText, quantityPrefix;
                if (typeCache.has(transaction.type)) {
                    const cached = typeCache.get(transaction.type);
                    typeColor = cached.color;
                    typeText = cached.text;
                    quantityPrefix = cached.prefix;
                } else {
                    typeColor = transaction.type === 'INBOUND' ? 'text-green-600' : 'text-red-600';
                    typeText = transaction.type === 'INBOUND' ? '입고' : '출고';
                    quantityPrefix = transaction.type === 'INBOUND' ? '+' : '-';
                    typeCache.set(transaction.type, { color: typeColor, text: typeText, prefix: quantityPrefix });
                }

                const date = transaction.date || 'N/A';
                const partNumber = transaction.part_number || 'N/A';
                const quantity = transaction.quantity !== undefined ? transaction.quantity : 0;
                const balanceAfter = transaction.balance_after !== undefined ? transaction.balance_after : 0;
                const referenceNumber = transaction.reference_number || 'N/A';

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${partNumber}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${typeColor}">
                            ${typeText}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${typeColor}">${quantityPrefix}${quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${balanceAfter}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${referenceNumber}</td>
                `;
                fragment.appendChild(row);
            });
        }
        
        // Performance: Single DOM update
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    getStockStatusColor(status) {
        switch (status) {
            case 'in_stock':
                return 'bg-green-100 text-green-800';
            case 'low_stock':
                return 'bg-yellow-100 text-yellow-800';
            case 'out_of_stock':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    getStockStatusText(status) {
        switch (status) {
            case 'in_stock':
                return '재고 있음';
            case 'low_stock':
                return '재고 부족';
            case 'out_of_stock':
                return '재고 없음';
            default:
                return '알 수 없음';
        }
    }

    updateStats() {
        // 총 파트 수
        const totalParts = this.inventory.length;
        
        // 부족 재고 수
        const lowStock = this.inventory.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock').length;

        // 디버깅을 위한 로그
        console.log('Updating stats:', {
            totalParts,
            lowStock,
            inventorySample: this.inventory.slice(0, 2) // 처음 2개 항목만 로그
        });

        document.getElementById('totalParts').textContent = totalParts;
        document.getElementById('lowStock').textContent = lowStock;
    }

    async refreshData() {
        // 실제 구현에서는 API 호출
        await this.loadData();
        this.updateStats();
        this.showNotification('데이터가 새로고침되었습니다.', 'success');
    }

    exportData(format = 'csv') {
        if (format === 'csv') {
            this.exportCSV();
        } else if (format === 'excel') {
            this.exportExcel();
        }
    }

    exportCSV() {
        // CSV 내보내기 기능 (한글 깨짐 방지)
        const csvContent = this.generateCSV();
        
        // BOM (Byte Order Mark) 추가하여 UTF-8 인코딩 명시
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;
        
        const blob = new Blob([csvWithBOM], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // 메모리 정리
        }
        
        this.showNotification('재고 데이터가 CSV로 내보내기되었습니다.', 'success');
    }

    exportExcel() {
        // Excel 내보내기 기능 (SheetJS 라이브러리 사용)
        try {
            // 워크북 생성
            const wb = XLSX.utils.book_new();
            
            // 재고 현황 데이터
            const inventoryData = this.filteredInventory.map(item => ({
                '파트 번호': item.part_number || item.partNumber,
                '현재 재고': item.current_stock !== undefined ? item.current_stock : (item.currentStock || 0),
                '재고 상태': this.getStockStatusText(item.status),
                '마지막 업데이트': item.last_updated || item.lastUpdated
            }));

            // 일간 내역 데이터
            const transactionData = this.filteredTransactions.map(transaction => ({
                '날짜': transaction.date,
                '파트 번호': transaction.partNumber,
                '유형': transaction.type === 'INBOUND' ? '입고' : '출고',
                '수량': transaction.quantity,
                '마감 재고': transaction.balanceAfter,
                '참조 번호': transaction.referenceNumber
            }));

            // 워크시트 생성
            const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
            const wsTransactions = XLSX.utils.json_to_sheet(transactionData);

            // 스타일링 적용
            this.applyInventoryExcelStyling(wsInventory, inventoryData);
            this.applyTransactionExcelStyling(wsTransactions, transactionData);

            // 컬럼 너비 설정
            wsInventory['!cols'] = [
                { wch: 15 }, // 파트 번호
                { wch: 12 }, // 현재 재고
                { wch: 12 }, // 재고 상태
                { wch: 20 }  // 마지막 업데이트
            ];

            wsTransactions['!cols'] = [
                { wch: 12 }, // 날짜
                { wch: 15 }, // 파트 번호
                { wch: 8 },  // 유형
                { wch: 10 }, // 수량
                { wch: 12 }, // 마감 재고
                { wch: 15 }  // 참조 번호
            ];

            // 워크북에 워크시트 추가
            XLSX.utils.book_append_sheet(wb, wsInventory, '재고 현황');
            XLSX.utils.book_append_sheet(wb, wsTransactions, '일간 내역');

            // 주말 수량 시트 추가
            const weekendData = this.generateWeekendData();
            if (weekendData.length > 0) {
                const wsWeekend = XLSX.utils.aoa_to_sheet(weekendData);
                this.applyWeekendExcelStyling(wsWeekend, weekendData);
                wsWeekend['!cols'] = [
                    { wch: 12 }, // 날짜
                    { wch: 15 }, // 파트 번호
                    { wch: 8 },  // 유형
                    { wch: 10 }, // 수량
                    { wch: 12 }, // 마감 재고
                    { wch: 15 }  // 참조 번호
                ];
                XLSX.utils.book_append_sheet(wb, wsWeekend, '주말수량');
            }

            // 파일 다운로드
            const fileName = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            this.showNotification('재고 데이터가 Excel로 내보내기되었습니다.', 'success');
        } catch (error) {
            console.error('Excel 내보내기 오류:', error);
            this.showNotification('Excel 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    applyInventoryExcelStyling(ws, data) {
        // 헤더 스타일링
        const headerRow = 1;
        const lastCol = Object.keys(data[0] || {}).length;
        
        for (let col = 1; col <= lastCol; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: headerRow - 1, c: col - 1 });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: "4472C4" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin" },
                        bottom: { style: "thin" },
                        left: { style: "thin" },
                        right: { style: "thin" }
                    }
                };
            }
        }
        
        // 데이터 셀 스타일링
        for (let row = 2; row <= data.length + 1; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
                if (ws[cellRef]) {
                    const item = data[row - 2];
                    const isLowStock = item && item['재고 상태'] === '재고 부족';
                    const isOutOfStock = item && item['재고 상태'] === '재고 없음';
                    
                    ws[cellRef].s = {
                        fill: { 
                            fgColor: { 
                                rgb: isOutOfStock ? "FFE6E6" : 
                                     isLowStock ? "FFF2E6" : "FFFFFF" 
                            } 
                        },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin" },
                            bottom: { style: "thin" },
                            left: { style: "thin" },
                            right: { style: "thin" }
                        }
                    };
                }
            }
        }
    }

    applyTransactionExcelStyling(ws, data) {
        // 헤더 스타일링
        const headerRow = 1;
        const lastCol = Object.keys(data[0] || {}).length;
        
        for (let col = 1; col <= lastCol; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: headerRow - 1, c: col - 1 });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: "8EAADB" } },
                    font: { color: { rgb: "000000" }, bold: true },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin" },
                        bottom: { style: "thin" },
                        left: { style: "thin" },
                        right: { style: "thin" }
                    }
                };
            }
        }
        
        // 데이터 셀 스타일링
        for (let row = 2; row <= data.length + 1; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
                if (ws[cellRef]) {
                    const item = data[row - 2];
                    const isInbound = item && item['유형'] === '입고';
                    
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: "FFFFFF" } },
                        font: { 
                            color: { 
                                rgb: isInbound ? "008000" : "FF0000" 
                            } 
                        },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin" },
                            bottom: { style: "thin" },
                            left: { style: "thin" },
                            right: { style: "thin" }
                        }
                    };
                }
            }
        }
    }

    applyWeekendExcelStyling(ws, data) {
        // 헤더 스타일링
        const headerRow = 1;
        const lastCol = data[0].length;
        
        for (let col = 1; col <= lastCol; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: headerRow - 1, c: col - 1 });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: "FF6B6B" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin" },
                        bottom: { style: "thin" },
                        left: { style: "thin" },
                        right: { style: "thin" }
                    }
                };
            }
        }
        
        // 데이터 셀 스타일링
        for (let row = 2; row <= data.length; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
                if (ws[cellRef]) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: "FFF2F2" } },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin" },
                            bottom: { style: "thin" },
                            left: { style: "thin" },
                            right: { style: "thin" }
                        }
                    };
                }
            }
        }
    }

    generateWeekendData() {
        const weekendData = [];
        
        // 헤더
        weekendData.push(['날짜', '파트 번호', '유형', '수량', '마감 재고', '참조 번호']);
        
        // 주말 데이터 수집
        this.transactions.forEach(transaction => {
            const dateObj = new Date(transaction.date);
            const dayOfWeek = dateObj.getDay();
            
            // 주말인 경우 (토요일: 6, 일요일: 0)
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                const dateStr = dateObj.toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit'
                });
                
                weekendData.push([
                    dateStr,
                    transaction.partNumber,
                    transaction.type === 'INBOUND' ? '입고' : '출고',
                    transaction.quantity,
                    transaction.balanceAfter,
                    transaction.referenceNumber
                ]);
            }
        });
        
        return weekendData;
    }

    generateCSV() {
        const headers = ['파트 번호', '현재 재고', '재고 상태', '마지막 업데이트'];
        const rows = this.filteredInventory.map(item => [
            item.part_number || item.partNumber,
            item.current_stock !== undefined ? item.current_stock : (item.currentStock || 0),
            this.getStockStatusText(item.status),
            item.last_updated || item.lastUpdated
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    updateCurrentTime() {
        // 미국 중부 시간 기준으로 현재 시간 표시
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
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // ===== 입고 관련 메서드들 =====

    showCsvUploadModal() {
        document.getElementById('csvUploadModal').classList.remove('hidden');
        this.resetCsvUpload();
    }

    closeCsvUploadModal() {
        document.getElementById('csvUploadModal').classList.add('hidden');
        this.resetCsvUpload();
    }

    resetCsvUpload() {
        document.getElementById('csvFileInput').value = '';
        document.getElementById('fileInfo').classList.remove('hidden');
        document.getElementById('removeFile').classList.add('hidden');
        document.getElementById('filePreview').innerHTML = '';
    }

    setupDragAndDrop() {
        const dropZone = document.querySelector('#csvUploadModal .border-dashed');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-400', 'bg-blue-50');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-400', 'bg-blue-50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-400', 'bg-blue-50');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect({ target: { files } });
            }
        });
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!this.isValidFileType(file)) {
            this.showNotification('지원되지 않는 파일 형식입니다. CSV 또는 Excel 파일을 선택해주세요.', 'error');
            return;
        }

        this.showFileInfo(file);
        this.showPreview(file);
    }

    isValidFileType(file) {
        const validTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        const validExtensions = ['.csv', '.xls', '.xlsx'];
        
        return validTypes.includes(file.type) || 
               validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.innerHTML = `
            <i class="fas fa-file-${this.getFileTypeFromName(file.name)} text-4xl text-blue-600 mb-4"></i>
            <p class="text-gray-900 font-medium mb-2">${file.name}</p>
            <p class="text-sm text-gray-500">${this.formatFileSize(file.size)}</p>
        `;
        fileInfo.classList.add('hidden');
        document.getElementById('removeFile').classList.remove('hidden');
    }

    getFileTypeFromName(fileName) {
        const ext = fileName.toLowerCase().split('.').pop();
        switch (ext) {
            case 'csv': return 'csv';
            case 'xls': return 'excel';
            case 'xlsx': return 'excel';
            default: return 'alt';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeSelectedFile() {
        document.getElementById('csvFileInput').value = '';
        document.getElementById('fileInfo').classList.remove('hidden');
        document.getElementById('removeFile').classList.add('hidden');
        document.getElementById('filePreview').innerHTML = '';
    }

    showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            let data;
            
            if (file.name.toLowerCase().endsWith('.csv')) {
                data = this.parseCsvContent(content);
            } else {
                data = this.parseExcelData(content);
            }
            
            if (data && data.length > 0) {
                this.renderFilePreview(data);
            }
        };
        
        if (file.name.toLowerCase().endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    }

    parseCsvContent(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim());
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
            }
        }
        
        return data;
    }

    parseExcelData(arrayBuffer) {
        try {
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length < 2) return null;
            
            const headers = jsonData[0];
            const dataRows = [];
            
            for (let i = 1; i < Math.min(jsonData.length, 6); i++) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = jsonData[i][index] || '';
                });
                dataRows.push(row);
            }
            
            return dataRows;
        } catch (error) {
            console.error('Excel 파일 파싱 오류:', error);
            return null;
        }
    }

    renderFilePreview(data) {
        const preview = document.getElementById('filePreview');
        if (data.length === 0) {
            preview.innerHTML = `<p class="text-red-500">${i18n.t('file_read_error')}</p>`;
            return;
        }

        const headers = Object.keys(data[0]);
        let html = `
            <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="font-medium text-gray-900 mb-3">파일 미리보기 (처음 ${data.length}행)</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead>
                            <tr class="bg-white">
                                ${headers.map(h => `<th class="px-3 py-2 text-left font-medium text-gray-700 border">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr class="bg-white">
                                    ${headers.map(h => `<td class="px-3 py-2 border">${row[h] || ''}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        preview.innerHTML = html;
    }

    async uploadFileData() {
        const fileInput = document.getElementById('csvFileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('파일을 선택해주세요.', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            if (file.name.toLowerCase().endsWith('.csv')) {
                await this.processCsvFileForUpload(file);
            } else {
                await this.processExcelFileForUpload(file);
            }
            
            this.showNotification('파일 업로드가 완료되었습니다.', 'success');
            this.closeCsvUploadModal();
            this.refreshData();
        } catch (error) {
            console.error('파일 업로드 오류:', error);
            this.showNotification('파일 업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async processCsvFileForUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    const data = this.parseCsvContent(content);
                    await this.processUploadData(data);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    async processExcelFileForUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = this.parseExcelData(e.target.result);
                    await this.processUploadData(data);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    async processUploadData(data) {
        const today = new Date().toISOString().split('T')[0];
        
        for (const row of data) {
            const partNumber = this.extractPartNumber(row);
            const quantity = this.extractQuantity(row);
            
            if (partNumber && quantity) {
                await this.processInbound(partNumber, quantity, today);
            }
        }
    }

    extractPartNumber(row) {
        const partKeys = ['파트', 'Part', '품목', 'Item', '번호', 'Number', 'part_number', 'partnumber'];
        for (const key of partKeys) {
            if (row[key]) {
                return row[key].toString().trim();
            }
        }
        return null;
    }

    extractQuantity(row) {
        const qtyKeys = ['수량', 'Quantity', 'QTY', '개수', 'Amount', 'quantity', 'qty'];
        for (const key of qtyKeys) {
            if (row[key]) {
                const qty = parseInt(row[key]);
                return isNaN(qty) ? 0 : qty;
            }
        }
        return 0;
    }

    async processInbound(partNumber, quantity, date) {
        try {
            // 1. 파트가 존재하는지 확인하고 없으면 생성
            await this.ensurePartExists(partNumber);
            
            // 2. 재고 업데이트
            const { data: inventoryData, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .single();

            if (inventoryError && inventoryError.code !== 'PGRST116') {
                throw inventoryError;
            }

            const currentStock = inventoryData ? inventoryData.current_stock : 0;
            const newStock = currentStock + quantity;

            // 3. 재고 테이블 업데이트 또는 생성
            if (inventoryData) {
                await this.supabase
                    .from('inventory')
                    .update({
                        current_stock: newStock,
                        last_updated: new Date().toISOString()
                    })
                    .eq('part_number', partNumber);
            } else {
                await this.supabase
                    .from('inventory')
                    .insert({
                        part_number: partNumber,
                        current_stock: newStock,
                        status: 'in_stock',
                        last_updated: new Date().toISOString()
                    });
            }

            // 4. 거래 내역 기록
            await this.supabase
                .from('inventory_transactions')
                .insert({
                    date: date,
                    part_number: partNumber,
                    type: 'INBOUND',
                    quantity: quantity,
                    balance_after: newStock,
                    reference_number: `CSV_${Date.now()}`
                });

        } catch (error) {
            console.error('입고 처리 오류:', error);
            throw error;
        }
    }

    async ensurePartExists(partNumber) {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .select('part_number')
                .eq('part_number', partNumber)
                .single();

            if (error && error.code === 'PGRST116') {
                // 파트가 존재하지 않으면 생성
                const category = this.determineCategory(partNumber);
                await this.supabase
                    .from('parts')
                    .insert({
                        part_number: partNumber,
                        category: category,
                        status: 'ACTIVE'
                    });
            }
        } catch (error) {
            console.error('파트 확인/생성 오류:', error);
            throw error;
        }
    }

    determineCategory(partNumber) {
        if (!partNumber) return 'INNER';
        
        const cleanPartNumber = partNumber.toString().trim();
        if (cleanPartNumber.startsWith('4960')) {
            return 'REAR';
        } else {
            return 'INNER';
        }
    }

    // 수동 입고 관련 메서드들
    showManualInboundModal() {
        document.getElementById('manualInboundModal').classList.remove('hidden');
        document.getElementById('inboundDate').value = new Date().toISOString().split('T')[0];
        this.createInitialPartField();
        this.loadMasterParts();
    }

    closeManualInboundModal() {
        document.getElementById('manualInboundModal').classList.add('hidden');
        this.resetManualForm();
    }

    resetManualForm() {
        document.getElementById('manualInboundForm').reset();
        document.getElementById('partsList').innerHTML = '';
        this.createInitialPartField();
    }

    createInitialPartField() {
        const partsList = document.getElementById('partsList');
        partsList.innerHTML = '';
        this.addPartField();
    }

    addPartField() {
        const partsList = document.getElementById('partsList');
        const partIndex = partsList.children.length;
        
        const partField = document.createElement('div');
        partField.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg';
        partField.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">파트 번호 <span class="text-red-500">*</span></label>
                <select name="partNumber_${partIndex}" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">파트 선택</option>
                    ${this.masterParts.map(part => `<option value="${part.part_number}">${part.part_number}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">수량 <span class="text-red-500">*</span></label>
                <input type="number" name="quantity_${partIndex}" required min="1" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="수량">
            </div>
            <div class="flex items-end">
                <button type="button" class="remove-part-btn bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm">
                    <i class="fas fa-trash mr-1"></i>제거
                </button>
            </div>
        `;
        
        partsList.appendChild(partField);
        
        // 제거 버튼 이벤트
        partField.querySelector('.remove-part-btn').addEventListener('click', () => {
            if (partsList.children.length > 1) {
                partField.remove();
            }
        });
    }

    async loadMasterParts() {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .select('part_number')
                .eq('status', 'ACTIVE')
                .order('part_number');

            if (error) throw error;
            
            this.masterParts = data || [];
            
            // 기존 파트 필드들의 드롭다운 업데이트
            const partSelects = document.querySelectorAll('[name^="partNumber_"]');
            partSelects.forEach(select => {
                const currentValue = select.value;
                select.innerHTML = `<option value="">${i18n.t('select_part_option')}</option>` + 
                    this.masterParts.map(part => `<option value="${part.part_number}">${part.part_number}</option>`).join('');
                select.value = currentValue;
            });
        } catch (error) {
            console.error('마스터 파트 로드 오류:', error);
        }
    }

    async submitManualInbound() {
        const form = document.getElementById('manualInboundForm');
        const formData = new FormData(form);
        
        const inboundDate = formData.get('inboundDate');
        const referenceNumber = formData.get('referenceNumber') || `MANUAL_${Date.now()}`;
        const supplier = formData.get('supplier') || '';
        
        const parts = [];
        const partFields = document.querySelectorAll('#partsList > div');
        
        for (let i = 0; i < partFields.length; i++) {
            const partNumber = formData.get(`partNumber_${i}`);
            const quantity = parseInt(formData.get(`quantity_${i}`));
            
            if (partNumber && quantity > 0) {
                parts.push({ partNumber, quantity });
            }
        }
        
        if (parts.length === 0) {
            this.showNotification('최소 하나의 파트를 입력해주세요.', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            for (const part of parts) {
                await this.processInbound(part.partNumber, part.quantity, inboundDate);
            }
            
            this.showNotification('입고 등록이 완료되었습니다.', 'success');
            this.closeManualInboundModal();
            this.refreshData();
        } catch (error) {
            console.error('수동 입고 등록 오류:', error);
            this.showNotification('입고 등록 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryStatus = new InventoryStatus();
}); 