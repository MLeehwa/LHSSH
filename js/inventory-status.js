// Inventory Status JavaScript - Performance Optimized
class InventoryStatus {
    constructor() {
        console.log('[LHSSH] 재고현황 v20260218');
        this.inventory = [];
        this.transactions = [];
        this.filteredInventory = [];
        this.filteredTransactions = [];
        this.filterTimeout = null;
        this.masterParts = [];

        // Performance optimizations
        this.cache = new Map();
        this.lastDataUpdate = 0;
        this.dataUpdateInterval = 5000; // 5초 자동 폴링 (실시간 반영)
        this.isLoading = false;
        this.domCache = new Map();

        // 자동 폴링 타이머
        this.autoRefreshTimer = null;

        // 정렬 관련
        this.sortColumn = null;
        this.sortDirection = 'asc'; // 'asc' or 'desc'

        // 날짜별 재고 계산 관련
        this.dateStockData = [];
        this.dateStockSortColumn = null;
        this.dateStockSortDirection = 'asc';

        // 일자별 입출고 현황 관련
        this.dailyInOutData = [];
        this.dailyInOutDateList = []; // 엑셀 다운로드용 날짜 목록

        // AS 필터 상태 추적
        this.lastIncludeAS = false; // 기본값: AS 제품 제외 (양산 제품만)

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

        // Realtime: 실시간 재고 변경 구독 대신 5초 자동 폴링
        this.startAutoRefresh();
    }

    // 5초 자동 폴링 - inventory/inventory_transactions 변경 감지
    startAutoRefresh() {
        // 기존 타이머 정리
        this.stopAutoRefresh();

        this.autoRefreshTimer = setInterval(async () => {
            // 캐시 만료시키기
            this.cache.clear();
            this.lastDataUpdate = 0;

            // 데이터 재로드 및 UI 갱신
            await this.loadData();
            this.updateStats();
        }, this.dataUpdateInterval);

        // 페이지 이탈 시 타이머 정리
        window.addEventListener('beforeunload', () => {
            this.stopAutoRefresh();
        });

        console.log('[AutoRefresh] ✅ 5초 자동 폴링 시작됨');
    }

    // 자동 폴링 정리
    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
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
        const container = document.getElementById('inventoryStatusContainer') || document.body;

        // Single event listener for all filter interactions
        container.addEventListener('input', (e) => {
            if (e.target.matches('#partNumberFilter')) {
                this.debouncedApplyFilters();
            }
        });

        container.addEventListener('change', async (e) => {
            if (e.target.matches('#dateFilter, #stockFilter')) {
                await this.applyFilters();
            } else if (e.target.matches('#includeASCheckbox')) {
                await this.handleASCheckboxChange();
            } else if (e.target.matches('#includeASCheckboxDateStock')) {
                // 날짜별 재고 계산은 계산 버튼을 눌러야 하므로 여기서는 처리하지 않음
            } else if (e.target.matches('#includeASCheckboxDailyInOut')) {
                // 일자별 입출고 현황은 조회 버튼을 눌러야 하므로 여기서는 처리하지 않음
            }
        });

        container.addEventListener('click', async (e) => {
            // Filter buttons
            if (e.target.matches('#applyFilter')) {
                await this.applyFilters();
            } else if (e.target.matches('#resetFilter')) {
                await this.resetFilters();
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

        // AS 체크박스 상태 확인 (캐시 체크 전에 확인)
        const includeASCheckbox = document.getElementById('includeASCheckbox');
        const includeAS = includeASCheckbox?.checked || false;

        // AS 상태가 변경되었거나 캐시가 만료되었을 때만 로드
        const cacheKey = includeAS ? 'data_with_as' : 'data_production';
        const lastCacheKey = this.lastIncludeAS ? 'data_with_as' : 'data_production';
        const asStateChanged = cacheKey !== lastCacheKey;

        if (!asStateChanged && now - this.lastDataUpdate < this.dataUpdateInterval) {
            console.log('Using cached data');
            return;
        }

        this.isLoading = true;

        try {
            console.log('데이터 로딩 시작... (AS 포함:', includeAS, ')');

            if (!this.supabase) {
                console.warn('Supabase 클라이언트가 초기화되지 않았습니다. 모의 데이터를 사용합니다.');
                this.loadMockData();
                return;
            }

            // AS 상태가 변경되었으면 캐시 클리어
            if (asStateChanged) {
                this.cache.clear();
            }

            // Performance: Load data in parallel
            const [inventoryResult, transactionResult] = await Promise.all([
                this.loadInventoryData(includeAS),
                this.loadTransactionData(includeAS)
            ]);

            this.inventory = inventoryResult;
            this.transactions = transactionResult;

            this.filteredInventory = [...this.inventory];
            this.filteredTransactions = [...this.transactions];

            this.lastDataUpdate = now;
            this.lastIncludeAS = includeAS; // 마지막 AS 상태 저장

            console.log('데이터 로드 완료. 총 재고:', this.inventory.length, '총 거래:', this.transactions.length, '(AS 포함:', includeAS, ')');

            this.renderInventory();
            this.renderTransactions();

        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            this.loadMockData();
        } finally {
            this.isLoading = false;
        }
    }

    async loadInventoryData(includeAS = false) {
        // AS 포함 여부에 따라 캐시 키 변경
        const cacheKey = includeAS ? 'inventory_data_with_as' : 'inventory_data_production';
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            console.log('재고 데이터 캐시 사용 (AS 포함:', includeAS, ', 개수:', cached.length, ')');
            return cached;
        }

        console.log('재고 데이터 로드 시작 (AS 포함:', includeAS, ')');

        // 1. 먼저 parts 테이블에서 필터링된 파트 목록 가져오기
        let partsQuery = this.supabase
            .from('parts')
            .select('part_number, product_type')
            .eq('status', 'ACTIVE');

        if (!includeAS) {
            // AS를 포함하지 않으면 PRODUCTION만, NULL이나 빈 값은 제외
            partsQuery = partsQuery.eq('product_type', 'PRODUCTION');
        } else {
            // AS를 포함할 때도 NULL이나 빈 값은 제외 (명시적으로 PRODUCTION 또는 AS만)
            partsQuery = partsQuery.in('product_type', ['PRODUCTION', 'AS']);
        }

        const { data: partsData, error: partsError } = await partsQuery;

        if (partsError) {
            console.error('파트 목록 로드 오류:', partsError);
            return this.getMockInventory();
        }

        if (!partsData || partsData.length === 0) {
            console.warn('필터링된 파트가 없습니다. (AS 포함:', includeAS, ')');
            return [];
        }

        // 추가 필터링: product_type이 NULL이거나 빈 값인 경우 제외
        const filteredParts = partsData.filter(p => {
            const productType = p.product_type;
            if (!includeAS) {
                // AS 포함 안 할 때: PRODUCTION만 허용
                return productType === 'PRODUCTION';
            } else {
                // AS 포함 할 때: PRODUCTION 또는 AS만 허용
                return productType === 'PRODUCTION' || productType === 'AS';
            }
        });

        // product_type이 잘못된 파트 확인
        const invalidParts = partsData.filter(p => {
            const productType = p.product_type;
            return !productType || (productType !== 'PRODUCTION' && productType !== 'AS');
        });

        if (invalidParts.length > 0) {
            console.warn('잘못된 product_type을 가진 파트:', invalidParts.map(p => ({
                part: p.part_number,
                product_type: p.product_type
            })));
        }

        console.log('필터링된 파트 개수:', filteredParts.length, '(AS 포함:', includeAS, ', 전체:', partsData.length, ')');

        const allowedPartNumbers = new Set(filteredParts.map(p => p.part_number));

        // 2. inventory 테이블에서 데이터 가져오기
        const { data: inventoryData, error: inventoryError } = await this.supabase
            .from('inventory')
            .select('*')
            .order('part_number');

        if (inventoryError) {
            console.error('재고 데이터 로드 오류:', inventoryError);
            return this.getMockInventory();
        }

        // 3. 필터링된 파트만 포함
        const result = (inventoryData || []).filter(item =>
            allowedPartNumbers.has(item.part_number)
        );

        console.log('필터링된 재고 데이터 개수:', result.length, '(전체:', inventoryData?.length || 0, ', AS 포함:', includeAS, ')');

        this.cache.set(cacheKey, result);
        return result;
    }

    async loadTransactionData(includeAS = false) {
        // AS 포함 여부에 따라 캐시 키 변경
        const cacheKey = includeAS ? 'transaction_data_with_as' : 'transaction_data_production';
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            console.log('거래 내역 데이터 캐시 사용 (AS 포함:', includeAS, ', 개수:', cached.length, ')');
            return cached;
        }

        console.log('거래 내역 데이터 로드 시작 (AS 포함:', includeAS, ')');

        // 1. 먼저 parts 테이블에서 필터링된 파트 목록 가져오기
        let partsQuery = this.supabase
            .from('parts')
            .select('part_number, product_type')
            .eq('status', 'ACTIVE');

        if (!includeAS) {
            // AS를 포함하지 않으면 PRODUCTION만, NULL이나 빈 값은 제외
            partsQuery = partsQuery.eq('product_type', 'PRODUCTION');
        } else {
            // AS를 포함할 때도 NULL이나 빈 값은 제외 (명시적으로 PRODUCTION 또는 AS만)
            partsQuery = partsQuery.in('product_type', ['PRODUCTION', 'AS']);
        }

        const { data: partsData, error: partsError } = await partsQuery;

        if (partsError) {
            console.error('파트 목록 로드 오류:', partsError);
            return this.getMockTransactions();
        }

        if (!partsData || partsData.length === 0) {
            console.warn('필터링된 파트가 없습니다. (AS 포함:', includeAS, ')');
            return [];
        }

        // 추가 필터링: product_type이 NULL이거나 빈 값인 경우 제외
        const filteredParts = partsData.filter(p => {
            const productType = p.product_type;
            if (!includeAS) {
                // AS 포함 안 할 때: PRODUCTION만 허용
                return productType === 'PRODUCTION';
            } else {
                // AS 포함 할 때: PRODUCTION 또는 AS만 허용
                return productType === 'PRODUCTION' || productType === 'AS';
            }
        });

        // product_type이 잘못된 파트 확인
        const invalidParts = partsData.filter(p => {
            const productType = p.product_type;
            return !productType || (productType !== 'PRODUCTION' && productType !== 'AS');
        });

        if (invalidParts.length > 0) {
            console.warn('잘못된 product_type을 가진 파트:', invalidParts.map(p => ({
                part: p.part_number,
                product_type: p.product_type
            })));
        }

        const allowedPartNumbers = new Set(filteredParts.map(p => p.part_number));

        // 2. inventory_transactions 테이블에서 데이터 가져오기
        const { data: transactionData, error: transactionError } = await this.supabase
            .from('inventory_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(100);

        if (transactionError) {
            console.error('거래 내역 데이터 로드 오류:', transactionError);
            return this.getMockTransactions();
        }

        // 3. 필터링된 파트만 포함
        const result = (transactionData || []).filter(item =>
            allowedPartNumbers.has(item.part_number)
        );

        console.log('필터링된 거래 내역 개수:', result.length, '(전체:', transactionData?.length || 0, ', AS 포함:', includeAS, ')');

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

        this.filterTimeout = setTimeout(async () => {
            await this.applyFilters();
        }, 150); // Reduced from 300ms to 150ms for better responsiveness
    }

    async applyFilters() {
        const partNumberFilter = document.getElementById('partNumberFilter')?.value?.toLowerCase() || '';
        const dateFilter = document.getElementById('dateFilter')?.value || '';
        const stockFilter = document.getElementById('stockFilter')?.value || '';
        const includeASCheckbox = document.getElementById('includeASCheckbox');
        const includeAS = includeASCheckbox?.checked || false;

        // AS 체크박스가 변경되었으면 데이터 재로드
        if (this.lastIncludeAS !== includeAS) {
            this.lastIncludeAS = includeAS;
            await this.loadData();
            return; // loadData에서 renderInventory와 renderTransactions를 호출하므로 여기서는 리턴
        }

        // Performance: Use more efficient filtering
        this.filteredInventory = this.inventory.filter(item => {
            const partNumber = (item.part_number || item.partNumber || '').toLowerCase();
            const matchesPartNumber = !partNumberFilter || partNumber.includes(partNumberFilter);
            const matchesStock = !stockFilter || item.status === stockFilter;
            return matchesPartNumber && matchesStock;
        });

        this.filteredTransactions = this.transactions.filter(transaction => {
            const partNumber = (transaction.part_number || transaction.partNumber || '').toLowerCase();
            const transactionDate = transaction.transaction_date || transaction.date || transaction.created_at || '';
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

    async handleASCheckboxChange() {
        // AS 체크박스 변경 시 데이터 재로드
        await this.applyFilters();
    }

    async resetFilters() {
        document.getElementById('partNumberFilter').value = '';
        document.getElementById('dateFilter').value = '';
        document.getElementById('stockFilter').value = '';
        // AS 체크박스도 초기화
        const includeASCheckbox = document.getElementById('includeASCheckbox');
        const wasChecked = includeASCheckbox?.checked || false;
        if (includeASCheckbox) {
            includeASCheckbox.checked = false;
        }

        // AS 체크박스가 변경되었으면 데이터 재로드
        if (wasChecked) {
            this.lastIncludeAS = false;
            await this.loadData();
        } else {
            this.filteredInventory = [...this.inventory];
            this.filteredTransactions = [...this.transactions];
            this.renderInventory();
            this.renderTransactions();
            this.updateStats();
        }
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

                // 날짜만 표시 (YYYY-MM-DD 형식)
                let formattedDate = 'N/A';
                if (lastUpdated !== 'N/A' && lastUpdated) {
                    try {
                        const date = new Date(lastUpdated);
                        if (!isNaN(date.getTime())) {
                            formattedDate = date.toISOString().split('T')[0];
                        }
                    } catch (e) {
                        // 날짜 파싱 실패 시 원본 표시
                        formattedDate = lastUpdated;
                    }
                }

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${partNumber}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${currentStock}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
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
                const transactionType = transaction.transaction_type || transaction.type;
                let typeColor, typeText, quantityPrefix;
                if (typeCache.has(transactionType)) {
                    const cached = typeCache.get(transactionType);
                    typeColor = cached.color;
                    typeText = cached.text;
                    quantityPrefix = cached.prefix;
                } else {
                    typeColor = transactionType === 'INBOUND' ? 'text-green-600' : 'text-red-600';
                    typeText = transactionType === 'INBOUND' ? '입고' : '출고';
                    quantityPrefix = transactionType === 'INBOUND' ? '+' : '-';
                    typeCache.set(transactionType, { color: typeColor, text: typeText, prefix: quantityPrefix });
                }

                const date = transaction.transaction_date || transaction.date || 'N/A';
                const partNumber = transaction.part_number || 'N/A';
                const quantity = transaction.quantity !== undefined ? transaction.quantity : 0;
                const balanceAfter = transaction.balance_after !== undefined ? transaction.balance_after : 0;
                const referenceNumber = transaction.reference_id || transaction.reference_number || 'N/A';

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
                '날짜': transaction.transaction_date || transaction.date,
                '파트 번호': transaction.part_number || transaction.partNumber,
                '유형': transaction.transaction_type === 'INBOUND' || transaction.type === 'INBOUND' ? '입고' : '출고',
                '수량': transaction.quantity,
                '마감 재고': transaction.balance_after || transaction.balanceAfter,
                '참조 번호': transaction.reference_id || transaction.reference_number || transaction.referenceNumber
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
            const transactionDate = transaction.transaction_date || transaction.date;
            if (!transactionDate) return;
            const dateObj = new Date(transactionDate);
            const dayOfWeek = dateObj.getDay();

            // 주말인 경우 (토요일: 6, 일요일: 0)
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                const dateStr = dateObj.toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit'
                });

                const transactionType = transaction.transaction_type || transaction.type;
                weekendData.push([
                    dateStr,
                    transaction.part_number || transaction.partNumber,
                    transactionType === 'INBOUND' ? '입고' : '출고',
                    transaction.quantity,
                    transaction.balance_after || transaction.balanceAfter,
                    transaction.reference_id || transaction.reference_number || transaction.referenceNumber
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
        notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${type === 'success' ? 'bg-green-500 text-white' :
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
            const date = this.extractDate(row) || today; // 각 행의 날짜를 추출, 없으면 오늘 날짜 사용

            if (partNumber && quantity) {
                await this.processInbound(partNumber, quantity, date);
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

    extractDate(row) {
        // 다양한 날짜 컬럼명 확인
        const dateKeys = ['날짜', 'Date', '입고일', '입고 날짜', '입고일자', 'date', 'A', 'a'];

        for (const key of dateKeys) {
            if (row[key]) {
                const dateValue = row[key];
                if (!dateValue) return null;

                // 날짜 형식 변환
                const dateStr = dateValue.toString().trim();

                // 이미 YYYY-MM-DD 형식인 경우
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    return dateStr;
                }

                // Excel 날짜 숫자 형식인 경우 (예: 44927)
                if (/^\d+$/.test(dateStr)) {
                    const excelDate = parseInt(dateStr);
                    // Excel의 날짜는 1900-01-01부터의 일수
                    const date = new Date((excelDate - 25569) * 86400 * 1000);
                    return date.toISOString().split('T')[0];
                }

                // YYYY/MM/DD 또는 MM/DD/YYYY 형식
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // YYYY/MM/DD 형식
                        if (parts[0].length === 4) {
                            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        }
                        // MM/DD/YYYY 형식
                        else {
                            return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                        }
                    }
                }

                // Date 객체인 경우
                if (dateValue instanceof Date) {
                    return dateValue.toISOString().split('T')[0];
                }

                // 다른 형식 시도
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            }
        }

        // 첫 번째 컬럼이 날짜인 경우 (A열)
        const firstKey = Object.keys(row)[0];
        if (firstKey && row[firstKey]) {
            const dateValue = row[firstKey];
            const dateStr = dateValue.toString().trim();

            // 날짜 형식인지 확인
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ||
                /^\d{4}\/\d{2}\/\d{2}$/.test(dateStr) ||
                /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr) ||
                /^\d+$/.test(dateStr)) {
                return this.extractDate({ [firstKey]: dateValue });
            }
        }

        return null;
    }

    async processInbound(partNumber, quantity, date) {
        try {
            const transactionDate = date.includes('T') ? date.split('T')[0] : date;

            // 1. 파트가 존재하는지 확인하고 없으면 생성
            await this.ensurePartExists(partNumber);

            // 2. inventory 조회 및 직접 UPDATE
            const { data: inventoryData, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock')
                .eq('part_number', partNumber)
                .maybeSingle();

            if (inventoryError && inventoryError.code !== 'PGRST116') {
                console.warn(`파트 ${partNumber} 재고 조회 오류:`, inventoryError);
            }

            let newStock = quantity;
            if (!inventoryData) {
                // 재고가 없으면 새로 생성
                await this.supabase
                    .from('inventory')
                    .insert({
                        part_number: partNumber,
                        current_stock: quantity,
                        status: 'in_stock',
                        last_updated: new Date().toISOString()
                    });
                console.log(`파트 ${partNumber} 재고 신규 생성: ${quantity}`);
            } else {
                // 기존 재고에 직접 더하기
                newStock = (inventoryData.current_stock || 0) + quantity;
                await this.supabase
                    .from('inventory')
                    .update({
                        current_stock: newStock,
                        last_updated: new Date().toISOString()
                    })
                    .eq('part_number', partNumber);
                console.log(`파트 ${partNumber} 재고: ${inventoryData.current_stock} → ${newStock}`);
            }

            // 3. 거래 내역 기록 (이력용, 트리거 무관)
            await this.supabase
                .from('inventory_transactions')
                .insert({
                    transaction_date: transactionDate,
                    part_number: partNumber,
                    transaction_type: 'INBOUND',
                    quantity: quantity,
                    reference_id: `MANUAL_${Date.now()}`,
                    notes: `수동 입고 처리`
                });

            // 4. daily_inventory_snapshot 업데이트
            try {
                await this.supabase
                    .from('daily_inventory_snapshot')
                    .upsert({
                        snapshot_date: transactionDate,
                        part_number: partNumber,
                        closing_stock: newStock
                    }, { onConflict: 'snapshot_date,part_number' });
            } catch (snapshotErr) {
                console.warn('daily_inventory_snapshot 업데이트 오류 (무시 가능):', snapshotErr);
            }

            console.log(`파트 ${partNumber} 입고 처리 완료 (직접 UPDATE + 트랜잭션 + 스냅샷)`);

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
                        status: 'ACTIVE',
                        product_type: 'PRODUCTION'  // 기본값: 양산 제품
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

    async loadMasterParts(includeAS = false) {
        try {
            let query = this.supabase
                .from('parts')
                .select('part_number')
                .eq('status', 'ACTIVE');

            // AS를 포함하지 않으면 양산 제품만
            if (!includeAS) {
                query = query.eq('product_type', 'PRODUCTION');
            }

            const { data, error } = await query.order('part_number');

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

    // 테이블 정렬 기능
    sortTable(column) {
        // 같은 컬럼을 클릭하면 정렬 방향 토글
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // 정렬 아이콘 업데이트
        this.updateSortIcons();

        // 데이터 정렬
        this.filteredInventory.sort((a, b) => {
            let aValue = a[column];
            let bValue = b[column];

            // null/undefined 처리
            if (aValue === null || aValue === undefined) aValue = '';
            if (bValue === null || bValue === undefined) bValue = '';

            // 날짜 컬럼 처리
            if (column === 'last_updated') {
                const aDate = aValue ? new Date(aValue).getTime() : 0;
                const bDate = bValue ? new Date(bValue).getTime() : 0;
                return this.sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
            }

            // 숫자 컬럼 처리
            if (column === 'current_stock') {
                const aNum = Number(aValue) || 0;
                const bNum = Number(bValue) || 0;
                return this.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // 문자열 컬럼 처리
            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();

            if (this.sortDirection === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });

        // 테이블 다시 렌더링
        this.renderInventory();
    }

    updateSortIcons() {
        // 모든 정렬 아이콘 초기화
        const columns = ['part_number', 'current_stock', 'status', 'last_updated'];
        columns.forEach(col => {
            const icon = document.getElementById(`sortIcon_${col}`);
            if (icon) {
                icon.className = 'fas fa-sort ml-1 text-gray-400';
            }
        });

        // 현재 정렬된 컬럼의 아이콘 업데이트
        if (this.sortColumn) {
            const icon = document.getElementById(`sortIcon_${this.sortColumn}`);
            if (icon) {
                if (this.sortDirection === 'asc') {
                    icon.className = 'fas fa-sort-up ml-1 text-blue-600';
                } else {
                    icon.className = 'fas fa-sort-down ml-1 text-blue-600';
                }
            }
        }
    }

    // 날짜별 재고 계산 (스냅샷 기반)
    async calculateDateStock() {
        const calculationDate = document.getElementById('stockCalculationDate').value;

        if (!calculationDate) {
            this.showNotification('기준일을 선택해주세요.', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // AS 체크박스 상태 확인
            const includeAS = document.getElementById('includeASCheckboxDateStock')?.checked || false;

            // 1. daily_inventory_snapshot 테이블에서 해당 날짜 데이터 조회
            const { data: snapshotData, error: snapshotError } = await this.supabase
                .from('daily_inventory_snapshot')
                .select('*')
                .eq('snapshot_date', calculationDate);

            if (snapshotError) {
                console.warn('daily_inventory_snapshot 조회 오류:', snapshotError);
                // 테이블이 없을 수 있으므로 에러만 로그하고 계속 진행
            }

            // 2. 모든 파트 목록 가져오기 (표시할 파트 필터링용)
            let partsQuery = this.supabase
                .from('parts')
                .select('part_number')
                .eq('status', 'ACTIVE');

            if (!includeAS) {
                partsQuery = partsQuery.eq('product_type', 'PRODUCTION');
            }

            const { data: allParts, error: partsError } = await partsQuery.order('part_number');
            if (partsError) throw partsError;

            const partSet = new Set(allParts.map(p => p.part_number));

            // 3. 스냅샷 데이터가 있으면 사용
            if (snapshotData && snapshotData.length > 0) {
                console.log(`스냅샷 데이터 발견: ${calculationDate} (${snapshotData.length}건)`);

                // 전날 스냅샷 가져오기 (전날 마감재고 = 오늘 시작재고)
                const prevDate = new Date(calculationDate);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevDateStr = prevDate.toISOString().split('T')[0];

                const { data: prevSnapshot } = await this.supabase
                    .from('daily_inventory_snapshot')
                    .select('part_number, closing_stock')
                    .eq('snapshot_date', prevDateStr);

                const prevStockMap = new Map();
                if (prevSnapshot) {
                    prevSnapshot.forEach(p => prevStockMap.set(p.part_number, p.closing_stock));
                }

                // 실제 입고/출고 거래 가져오기 (INBOUND, OUTBOUND만)
                const { data: dailyTrans } = await this.supabase
                    .from('inventory_transactions')
                    .select('part_number, transaction_type, quantity')
                    .eq('transaction_date', calculationDate)
                    .in('transaction_type', ['INBOUND', 'OUTBOUND']);

                const inboundMap = new Map();
                const outboundMap = new Map();
                if (dailyTrans) {
                    dailyTrans.forEach(t => {
                        if (t.transaction_type === 'INBOUND') {
                            inboundMap.set(t.part_number, (inboundMap.get(t.part_number) || 0) + (t.quantity || 0));
                        } else if (t.transaction_type === 'OUTBOUND') {
                            outboundMap.set(t.part_number, (outboundMap.get(t.part_number) || 0) + (t.quantity || 0));
                        }
                    });
                }

                // 스냅샷 → dateStockData 변환
                // 마감재고(closing_stock) = 전날마감(시작) + 입고 - 출고 + 실사조정
                // 실사조정 = 마감재고 - 전날마감 - 입고 + 출고 (잔차)
                this.dateStockData = snapshotData
                    .filter(item => partSet.has(item.part_number))
                    .map(item => {
                        const closingStock = item.closing_stock;
                        const prevStock = prevStockMap.get(item.part_number);
                        const inbound = inboundMap.get(item.part_number) || 0;
                        const outbound = outboundMap.get(item.part_number) || 0;

                        // 전날 스냅샷이 있으면 잔차를 실사조정으로 계산
                        let adjustment = 0;
                        const startStock = prevStock !== undefined ? prevStock : closingStock;
                        if (prevStock !== undefined) {
                            adjustment = closingStock - prevStock - inbound + outbound;
                        }

                        return {
                            part_number: item.part_number,
                            previous_stock: startStock,
                            daily_inbound: inbound,
                            daily_outbound: outbound,
                            daily_adjustment: adjustment,
                            calculated_stock: closingStock
                        };
                    });

            } else {
                // 4. 스냅샷이 없으면: 가장 가까운 이전 스냅샷 + 이후 거래로 순방향 계산
                console.log(`스냅샷 없음 (${calculationDate}). 순방향 계산 시도...`);

                // 가장 가까운 이전 스냅샷 찾기
                const { data: prevSnapshots } = await this.supabase
                    .from('daily_inventory_snapshot')
                    .select('snapshot_date, part_number, closing_stock')
                    .lt('snapshot_date', calculationDate)
                    .order('snapshot_date', { ascending: false })
                    .limit(100); // 최대 파트 수만큼

                if (!prevSnapshots || prevSnapshots.length === 0) {
                    this.showNotification(`${calculationDate} 이전에 스냅샷 데이터가 없습니다. 엑셀 업로드로 기준 데이터를 등록해주세요.`, 'warning');
                    this.dateStockData = [];
                    this.renderDateStockTable();
                    this.showLoading(false);
                    return;
                }

                // 가장 가까운 날짜의 스냅샷 사용
                const baseDate = prevSnapshots[0].snapshot_date;
                const baseStockMap = new Map();
                prevSnapshots
                    .filter(s => s.snapshot_date === baseDate)
                    .forEach(s => baseStockMap.set(s.part_number, s.closing_stock));

                console.log(`기준 스냅샷: ${baseDate} (${baseStockMap.size}개 파트)`);

                // 기준 날짜 다음날 ~ 기준일까지의 거래 내역 가져오기
                const nextDate = new Date(baseDate);
                nextDate.setDate(nextDate.getDate() + 1);
                const nextDateStr = nextDate.toISOString().split('T')[0];

                const { data: rangeTrans, error: rangeError } = await this.supabase
                    .from('inventory_transactions')
                    .select('part_number, transaction_type, quantity, transaction_date')
                    .gte('transaction_date', nextDateStr)
                    .lte('transaction_date', calculationDate);

                if (rangeError) throw rangeError;

                // 기준일까지 순방향 누적
                const stockMap = new Map();
                allParts.forEach(p => {
                    stockMap.set(p.part_number, {
                        part_number: p.part_number,
                        previous_stock: baseStockMap.get(p.part_number) || 0,
                        daily_inbound: 0,
                        daily_outbound: 0,
                        daily_adjustment: 0,
                        calculated_stock: baseStockMap.get(p.part_number) || 0
                    });
                });

                // 기준일 이전까지의 거래를 누적 (전날 재고 계산)
                if (rangeTrans) {
                    // 기준일 이전의 거래
                    rangeTrans.filter(t => t.transaction_date < calculationDate).forEach(t => {
                        if (stockMap.has(t.part_number)) {
                            const stock = stockMap.get(t.part_number);
                            if (t.transaction_type === 'INBOUND') {
                                stock.previous_stock += t.quantity || 0;
                            } else if (t.transaction_type === 'OUTBOUND') {
                                stock.previous_stock -= t.quantity || 0;
                            } else if (t.transaction_type === 'ADJUSTMENT') {
                                stock.previous_stock += t.quantity || 0;
                            }
                        }
                    });

                    // 기준일의 거래만 집계
                    rangeTrans.filter(t => t.transaction_date === calculationDate).forEach(t => {
                        if (stockMap.has(t.part_number)) {
                            const stock = stockMap.get(t.part_number);
                            if (t.transaction_type === 'INBOUND') {
                                stock.daily_inbound += t.quantity || 0;
                            } else if (t.transaction_type === 'OUTBOUND') {
                                stock.daily_outbound += t.quantity || 0;
                            } else if (t.transaction_type === 'ADJUSTMENT') {
                                stock.daily_adjustment += t.quantity || 0;
                            }
                        }
                    });
                }

                // 금일 재고 계산
                stockMap.forEach(stock => {
                    stock.calculated_stock = stock.previous_stock + stock.daily_inbound - stock.daily_outbound + stock.daily_adjustment;
                });

                this.dateStockData = Array.from(stockMap.values());
            }

            // 테이블 렌더링
            this.renderDateStockTable();

            this.showNotification(`${calculationDate} 기준 재고 조회가 완료되었습니다.`, 'success');
        } catch (error) {
            console.error('날짜별 재고 조회 오류:', error);
            this.showNotification('재고 조회 중 오류가 발생했습니다: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 엑셀 업로드 → daily_inventory_snapshot 저장
    showSnapshotUploadModal() {
        document.getElementById('snapshotUploadModal').classList.remove('hidden');
    }

    closeSnapshotUploadModal() {
        document.getElementById('snapshotUploadModal').classList.add('hidden');
        // 파일 입력 초기화
        const fileInput = document.getElementById('snapshotFileInput');
        if (fileInput) fileInput.value = '';
        const preview = document.getElementById('snapshotPreview');
        if (preview) preview.innerHTML = '';
    }

    async uploadDailySnapshot() {
        const fileInput = document.getElementById('snapshotFileInput');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            this.showNotification('엑셀 파일을 선택해주세요.', 'error');
            return;
        }

        const file = fileInput.files[0];
        this.showLoading(true);

        try {
            // 엑셀 파일 읽기 (XLSX는 CDN으로 이미 로드됨)
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                this.showNotification('엑셀 파일에 데이터가 부족합니다.', 'error');
                this.showLoading(false);
                return;
            }

            // 첫 행: 헤더 (날짜, 파트번호1, 파트번호2, ...)
            const headers = jsonData[0];
            const partNumbers = headers.slice(1); // 첫 열은 날짜

            console.log('파트번호 목록:', partNumbers);

            // 데이터 행 파싱
            const records = [];
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || !row[0]) continue;

                // 날짜 변환 (엑셀 시리얼 넘버 또는 문자열)
                let dateStr;
                if (typeof row[0] === 'number') {
                    // 엑셀 시리얼 넘버 → 날짜 변환
                    const excelDate = new Date((row[0] - 25569) * 86400000);
                    dateStr = excelDate.toISOString().split('T')[0];
                } else {
                    dateStr = String(row[0]).trim();
                    // YYYY-MM-DD 형식 확인
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        console.warn(`유효하지 않은 날짜 형식: ${dateStr}, 행 ${i + 1}`);
                        continue;
                    }
                }

                // 각 파트별 마감재고
                for (let j = 0; j < partNumbers.length; j++) {
                    const partNumber = String(partNumbers[j]).trim();
                    const closingStock = parseInt(row[j + 1]) || 0;

                    if (partNumber) {
                        records.push({
                            snapshot_date: dateStr,
                            part_number: partNumber,
                            closing_stock: closingStock
                        });
                    }
                }
            }

            if (records.length === 0) {
                this.showNotification('파싱된 데이터가 없습니다. 엑셀 형식을 확인해주세요.', 'error');
                this.showLoading(false);
                return;
            }

            console.log(`총 ${records.length}건 업로드 시작...`);

            // Supabase에 upsert (배치 처리)
            const batchSize = 50;
            let uploaded = 0;
            let errors = 0;

            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);

                const { error: upsertError } = await this.supabase
                    .from('daily_inventory_snapshot')
                    .upsert(batch, {
                        onConflict: 'snapshot_date,part_number'
                    });

                if (upsertError) {
                    console.error('upsert 오류:', upsertError);
                    errors += batch.length;
                } else {
                    uploaded += batch.length;
                }
            }

            // 결과 정리
            const dates = [...new Set(records.map(r => r.snapshot_date))].sort();
            const parts = [...new Set(records.map(r => r.part_number))];

            this.closeSnapshotUploadModal();
            this.showNotification(
                `업로드 완료! ${dates.length}일 × ${parts.length}파트 = ${uploaded}건 저장` +
                (errors > 0 ? ` (${errors}건 오류)` : ''),
                errors > 0 ? 'warning' : 'success'
            );

            console.log(`업로드 완료: ${dates[0]} ~ ${dates[dates.length - 1]}`);
            console.log('파트:', parts);

        } catch (error) {
            console.error('엑셀 업로드 오류:', error);
            this.showNotification('엑셀 파일 처리 중 오류가 발생했습니다: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 엑셀 파일 미리보기
    previewSnapshotFile() {
        const fileInput = document.getElementById('snapshotFileInput');
        const preview = document.getElementById('snapshotPreview');

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            if (preview) preview.innerHTML = '<p class="text-gray-500">파일을 선택해주세요.</p>';
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length < 2) {
                    preview.innerHTML = '<p class="text-red-500">데이터가 부족합니다.</p>';
                    return;
                }

                const headers = jsonData[0];
                const maxRows = Math.min(5, jsonData.length);

                let html = `<p class="text-sm text-gray-600 mb-2">총 ${jsonData.length - 1}일 × ${headers.length - 1}파트</p>`;
                html += '<div class="overflow-x-auto"><table class="text-xs border-collapse w-full">';
                html += '<thead><tr>';
                headers.forEach(h => {
                    html += `<th class="border px-2 py-1 bg-gray-100 whitespace-nowrap">${h}</th>`;
                });
                html += '</tr></thead><tbody>';

                for (let i = 1; i < maxRows; i++) {
                    html += '<tr>';
                    const row = jsonData[i];
                    for (let j = 0; j < headers.length; j++) {
                        let val = row[j] || '';
                        if (j === 0 && typeof val === 'number') {
                            const d = new Date((val - 25569) * 86400000);
                            val = d.toISOString().split('T')[0];
                        }
                        html += `<td class="border px-2 py-1 whitespace-nowrap">${val}</td>`;
                    }
                    html += '</tr>';
                }

                if (jsonData.length > maxRows) {
                    html += `<tr><td colspan="${headers.length}" class="border px-2 py-1 text-center text-gray-400">... ${jsonData.length - maxRows}행 더 있음</td></tr>`;
                }

                html += '</tbody></table></div>';
                preview.innerHTML = html;
            } catch (err) {
                preview.innerHTML = `<p class="text-red-500">파일 읽기 오류: ${err.message}</p>`;
            }
        };

        reader.readAsArrayBuffer(file);
    }

    // 일자별 입출고 현황 데이터 로드
    async loadDailyInOutData() {
        const startDate = document.getElementById('dailyInOutStartDate').value;
        const endDate = document.getElementById('dailyInOutEndDate').value;

        if (!startDate || !endDate) {
            this.showNotification('시작일과 종료일을 모두 선택해주세요.', 'error');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showNotification('시작일이 종료일보다 늦을 수 없습니다.', 'error');
            return;
        }

        // 날짜 범위가 너무 크면 경고
        const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
        if (daysDiff > 31) {
            if (!confirm(`선택한 날짜 범위가 ${daysDiff}일입니다. 많은 데이터를 조회하므로 시간이 걸릴 수 있습니다. 계속하시겠습니까?`)) {
                return;
            }
        }

        this.showLoading(true);

        try {
            // 날짜 목록 생성 (로컬 시간 기준, 오늘 날짜 포함)
            const dateList = [];
            const currentDate = new Date(startDate + 'T00:00:00'); // 로컬 시간으로 명시적 설정
            const endDateObj = new Date(endDate + 'T23:59:59'); // 종료일 포함을 위해 시간 추가

            while (currentDate <= endDateObj) {
                // 로컬 시간 기준으로 날짜 추출 (YYYY-MM-DD)
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                dateList.push(`${year}-${month}-${day}`);
                currentDate.setDate(currentDate.getDate() + 1);
            }

            console.log(`일자별 입출고 현황 조회: ${startDate} ~ ${endDate} (${dateList.length}일)`);

            // AS 체크박스 상태 확인
            const includeAS = document.getElementById('includeASCheckboxDailyInOut')?.checked || false;

            // 1. 모든 파트 목록 가져오기
            let query = this.supabase
                .from('parts')
                .select('part_number')
                .eq('status', 'ACTIVE');

            // AS를 포함하지 않으면 양산 제품만
            if (!includeAS) {
                query = query.eq('product_type', 'PRODUCTION');
            }

            const { data: allParts, error: partsError } = await query.order('part_number');

            if (partsError) throw partsError;

            // 2. 날짜 범위의 모든 거래 내역 가져오기
            // 먼저 모든 거래 내역을 가져와서 날짜 필터링을 클라이언트에서 수행
            // (Supabase의 날짜 필터링이 정확하지 않을 수 있음)
            const { data: allTransactions, error: transError } = await this.supabase
                .from('inventory_transactions')
                .select('part_number, transaction_type, quantity, transaction_date')
                .order('transaction_date', { ascending: true });

            if (transError) {
                console.error('거래 내역 조회 오류:', transError);
                throw transError;
            }

            // 클라이언트에서 날짜 범위 필터링
            const transactions = (allTransactions || []).filter(t => {
                if (!t.transaction_date) return false;

                // 날짜 형식 정규화
                let transDate;
                if (typeof t.transaction_date === 'string') {
                    transDate = t.transaction_date.split('T')[0];
                } else if (t.transaction_date instanceof Date) {
                    transDate = t.transaction_date.toISOString().split('T')[0];
                } else {
                    transDate = new Date(t.transaction_date).toISOString().split('T')[0];
                }

                return transDate >= startDate && transDate <= endDate;
            });

            console.log(`원본 거래 내역: ${allTransactions?.length || 0}건, 필터링 후: ${transactions.length}건`);

            // 디버깅: 거래 내역 확인
            console.log(`=== 거래 내역 조회 결과 ===`);
            console.log(`총 거래 내역: ${transactions?.length || 0}건`);
            console.log(`조회 기간: ${startDate} ~ ${endDate}`);

            // 원본 데이터에서 모든 transaction_type 확인
            if (allTransactions && allTransactions.length > 0) {
                const allTypes = {};
                allTransactions.forEach(t => {
                    const type = (t.transaction_type || 'NULL').toUpperCase();
                    allTypes[type] = (allTypes[type] || 0) + 1;
                });
                console.log('원본 데이터의 모든 transaction_type:', allTypes);
            }

            if (transactions && transactions.length > 0) {
                console.log('거래 내역 샘플 (최대 10건):', transactions.slice(0, 10).map(t => ({
                    part: t.part_number,
                    type: t.transaction_type,
                    typeUpper: (t.transaction_type || '').toUpperCase(),
                    qty: t.quantity,
                    date: t.transaction_date,
                    dateType: typeof t.transaction_date,
                    dateNormalized: typeof t.transaction_date === 'string'
                        ? t.transaction_date.split('T')[0]
                        : new Date(t.transaction_date).toISOString().split('T')[0]
                })));

                const inboundCount = transactions.filter(t => {
                    const type = (t.transaction_type || '').toUpperCase();
                    return type === 'INBOUND';
                }).length;
                const outboundCount = transactions.filter(t => {
                    const type = (t.transaction_type || '').toUpperCase();
                    return type === 'OUTBOUND';
                }).length;

                console.log(`입고(INBOUND) 건수: ${inboundCount}건`);
                console.log(`출고(OUTBOUND) 건수: ${outboundCount}건`);
                console.log(`기타 타입: ${transactions.length - inboundCount - outboundCount}건`);

                // OUTBOUND가 없는 경우 원본 데이터에서 확인
                if (outboundCount === 0 && allTransactions) {
                    const allOutbound = allTransactions.filter(t => {
                        const type = (t.transaction_type || '').toUpperCase();
                        return type === 'OUTBOUND';
                    });
                    console.warn(`⚠️ 필터링된 데이터에 OUTBOUND가 없지만, 원본 데이터에는 ${allOutbound.length}건의 OUTBOUND가 있습니다!`);
                    if (allOutbound.length > 0) {
                        console.log('원본 OUTBOUND 샘플 (최대 5건):', allOutbound.slice(0, 5).map(t => ({
                            part: t.part_number,
                            type: t.transaction_type,
                            qty: t.quantity,
                            date: t.transaction_date,
                            dateNormalized: typeof t.transaction_date === 'string'
                                ? t.transaction_date.split('T')[0]
                                : new Date(t.transaction_date).toISOString().split('T')[0],
                            inRange: (() => {
                                const date = typeof t.transaction_date === 'string'
                                    ? t.transaction_date.split('T')[0]
                                    : new Date(t.transaction_date).toISOString().split('T')[0];
                                return date >= startDate && date <= endDate;
                            })()
                        })));
                    }
                }

                // 날짜별 분포 확인
                const dateDistribution = {};
                transactions.forEach(t => {
                    if (!t.transaction_date) return;
                    const date = typeof t.transaction_date === 'string'
                        ? t.transaction_date.split('T')[0]
                        : new Date(t.transaction_date).toISOString().split('T')[0];
                    dateDistribution[date] = (dateDistribution[date] || 0) + 1;
                });
                console.log('날짜별 거래 내역 분포:', dateDistribution);
            } else {
                console.warn('⚠️ 거래 내역이 없습니다!');
                if (allTransactions && allTransactions.length > 0) {
                    console.log(`원본 데이터에는 ${allTransactions.length}건이 있지만, 날짜 필터링 후 0건입니다.`);
                    console.log('원본 데이터 날짜 범위 확인 필요');
                } else {
                    console.log('데이터베이스에서 직접 확인이 필요합니다.');
                }
            }

            // 3. 날짜 범위의 실사 재고 정보 가져오기
            const { data: sessions, error: sessionsError } = await this.supabase
                .from('physical_inventory_sessions')
                .select('id, session_date')
                .gte('session_date', startDate)
                .lte('session_date', endDate)
                .in('status', ['PENDING', 'COMPLETED']);

            let physicalInventoryItems = [];
            if (!sessionsError && sessions && sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                const { data: items, error: itemsError } = await this.supabase
                    .from('physical_inventory_items')
                    .select('part_number, physical_stock, system_stock, created_at, session_id')
                    .in('session_id', sessionIds);

                if (!itemsError && items) {
                    // 세션 날짜 정보 추가
                    const sessionMap = new Map(sessions.map(s => [s.id, s.session_date]));
                    physicalInventoryItems = items.map(item => ({
                        ...item,
                        session_date: sessionMap.get(item.session_id)
                    }));
                }
            }

            // 4. 각 날짜별로 입고/출고/재고 계산
            const partDataMap = new Map();

            // 모든 파트 초기화
            allParts.forEach(part => {
                partDataMap.set(part.part_number, {
                    part_number: part.part_number,
                    dates: {}
                });
            });

            // 각 날짜별로 데이터 계산
            dateList.forEach((date, dateIndex) => {
                // 해당 날짜의 거래 내역 필터링 (날짜 형식 정규화)
                const dateTransactions = transactions.filter(t => {
                    if (!t.transaction_date) return false;
                    // transaction_date가 날짜만 있는지, 시간이 포함되어 있는지 확인
                    const transDate = typeof t.transaction_date === 'string'
                        ? t.transaction_date.split('T')[0]
                        : new Date(t.transaction_date).toISOString().split('T')[0];
                    return transDate === date;
                });

                // 디버깅: 첫 번째 날짜와 마지막 날짜만 상세 로그
                if (dateIndex === 0 || dateIndex === dateList.length - 1) {
                    console.log(`날짜 ${date} 필터링 결과:`, {
                        totalTransactions: transactions.length,
                        filteredCount: dateTransactions.length,
                        sample: dateTransactions.slice(0, 3).map(t => ({
                            part: t.part_number,
                            type: t.transaction_type,
                            qty: t.quantity,
                            date: t.transaction_date
                        }))
                    });
                }

                // 해당 날짜의 실사 재고 필터링 (날짜 형식 정규화)
                const datePhysicalItems = physicalInventoryItems.filter(item => {
                    if (!item.session_date) return false;
                    const sessionDate = typeof item.session_date === 'string'
                        ? item.session_date.split('T')[0]
                        : new Date(item.session_date).toISOString().split('T')[0];
                    return sessionDate === date;
                });

                // 파트별로 입고/출고 집계
                const dateInbound = {};
                const dateOutbound = {};
                const dateAdjustment = {};

                dateTransactions.forEach(trans => {
                    if (!trans.part_number) {
                        console.warn('part_number가 없는 거래 내역:', trans);
                        return; // part_number가 없으면 스킵
                    }

                    if (!partDataMap.has(trans.part_number)) {
                        partDataMap.set(trans.part_number, {
                            part_number: trans.part_number,
                            dates: {}
                        });
                    }

                    const quantity = Number(trans.quantity) || 0;

                    // transaction_type 대소문자 무시하고 비교
                    const transType = (trans.transaction_type || '').toUpperCase();

                    // 디버깅: OUTBOUND 데이터 확인
                    if (dateIndex === 0 && transType === 'OUTBOUND') {
                        console.log('OUTBOUND 거래 내역 발견:', {
                            part: trans.part_number,
                            type: trans.transaction_type,
                            originalQty: trans.quantity,
                            parsedQty: quantity,
                            absQty: Math.abs(quantity)
                        });
                    }

                    if (transType === 'INBOUND') {
                        dateInbound[trans.part_number] = (dateInbound[trans.part_number] || 0) + quantity;
                    } else if (transType === 'OUTBOUND') {
                        // OUTBOUND는 양수로 저장되어 있지만, 혹시 음수일 수도 있으므로 절댓값 사용
                        const outboundQty = quantity < 0 ? Math.abs(quantity) : quantity;
                        dateOutbound[trans.part_number] = (dateOutbound[trans.part_number] || 0) + outboundQty;

                        // 디버깅: 첫 번째 날짜의 OUTBOUND 집계 확인
                        if (dateIndex === 0) {
                            console.log(`OUTBOUND 집계: 파트 ${trans.part_number}, 수량 ${outboundQty}, 누적: ${dateOutbound[trans.part_number]}`);
                        }
                    } else if (transType === 'ADJUSTMENT') {
                        dateAdjustment[trans.part_number] = (dateAdjustment[trans.part_number] || 0) + quantity;
                    } else {
                        // 알 수 없는 타입 로그
                        if (dateIndex === 0) {
                            console.warn(`알 수 없는 transaction_type: ${trans.transaction_type}`, trans);
                        }
                    }
                });

                // 디버깅: 첫 번째 날짜의 집계 결과 확인
                if (dateIndex === 0) {
                    const inboundTotal = Object.values(dateInbound).reduce((a, b) => a + b, 0);
                    const outboundTotal = Object.values(dateOutbound).reduce((a, b) => a + b, 0);

                    console.log(`=== 날짜 ${date} 집계 결과 ===`);
                    console.log(`입고 파트 수: ${Object.keys(dateInbound).length}개`);
                    console.log(`출고 파트 수: ${Object.keys(dateOutbound).length}개`);
                    console.log(`입고 총합: ${inboundTotal}`);
                    console.log(`출고 총합: ${outboundTotal}`);
                    console.log('입고 샘플:', Object.entries(dateInbound).slice(0, 5));
                    console.log('출고 샘플:', Object.entries(dateOutbound).slice(0, 5));

                    // OUTBOUND가 0인 경우 상세 디버깅
                    if (outboundTotal === 0 && dateTransactions.some(t => {
                        const type = (t.transaction_type || '').toUpperCase();
                        return type === 'OUTBOUND';
                    })) {
                        console.warn('⚠️ OUTBOUND 거래 내역이 있지만 집계가 0입니다!');
                        const outboundTrans = dateTransactions.filter(t => {
                            const type = (t.transaction_type || '').toUpperCase();
                            return type === 'OUTBOUND';
                        });
                        console.log('OUTBOUND 거래 내역 상세:', outboundTrans.map(t => ({
                            part: t.part_number,
                            type: t.transaction_type,
                            qty: t.quantity,
                            qtyType: typeof t.quantity
                        })));
                    }
                }

                // 실사 재고 조정
                datePhysicalItems.forEach(item => {
                    if (!item.part_number) return; // part_number가 없으면 스킵

                    const physicalStock = Number(item.physical_stock) || 0;
                    const systemStock = Number(item.system_stock) || 0;
                    const difference = physicalStock - systemStock;
                    dateAdjustment[item.part_number] = (dateAdjustment[item.part_number] || 0) + difference;
                });

                // 각 파트별로 날짜별 데이터 저장
                partDataMap.forEach((partData, partNumber) => {
                    partData.dates[date] = {
                        inbound: dateInbound[partNumber] || 0,
                        outbound: dateOutbound[partNumber] || 0,
                        adjustment: dateAdjustment[partNumber] || 0
                    };
                });
            });

            // 5. 각 날짜별 재고 계산 (전날 재고 + 입고 - 출고 + 조정)
            // 현재 재고를 기준으로 역산하여 시작일 전날 재고 계산
            const dayBeforeStart = new Date(startDate + 'T00:00:00');
            dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
            const dayBeforeStartStr = `${dayBeforeStart.getFullYear()}-${String(dayBeforeStart.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeStart.getDate()).padStart(2, '0')}`;

            // 전날 재고 계산: 현재 재고에서 시작일 이후 거래 내역을 역산
            const previousStockMap = new Map();
            try {
                // 1. 현재 재고 가져오기
                const { data: currentInventory, error: invError } = await this.supabase
                    .from('inventory')
                    .select('part_number, current_stock');

                if (!invError && currentInventory) {
                    const inventoryMap = new Map(currentInventory.map(inv => [inv.part_number, inv.current_stock || 0]));

                    // 2. 시작일 이후의 모든 거래 내역 가져오기 (역산용)
                    const { data: futureTransactions } = await this.supabase
                        .from('inventory_transactions')
                        .select('part_number, transaction_type, quantity')
                        .gte('transaction_date', startDate);

                    // 3. 각 파트별로 현재 재고에서 역산하여 시작일 전날 재고 계산
                    allParts.forEach(part => {
                        const currentStock = inventoryMap.get(part.part_number) || 0;
                        let previousStock = currentStock;

                        // 시작일 이후 거래 내역을 역산
                        if (futureTransactions) {
                            futureTransactions
                                .filter(t => t.part_number === part.part_number)
                                .forEach(trans => {
                                    if (trans.transaction_type === 'INBOUND') {
                                        previousStock -= trans.quantity; // 입고를 빼서 역산
                                    } else if (trans.transaction_type === 'OUTBOUND') {
                                        previousStock += Math.abs(trans.quantity); // 출고를 더해서 역산
                                    } else if (trans.transaction_type === 'ADJUSTMENT') {
                                        previousStock -= trans.quantity; // 조정을 빼서 역산
                                    }
                                });
                        }

                        previousStockMap.set(part.part_number, previousStock);
                    });
                } else {
                    // inventory 테이블이 없거나 오류가 있으면 기존 방식 사용
                    console.warn('inventory 테이블 조회 실패, 기존 방식으로 전날 재고 계산');
                    const { data: prevTransactions } = await this.supabase
                        .from('inventory_transactions')
                        .select('part_number, transaction_type, quantity')
                        .lte('transaction_date', dayBeforeStartStr);

                    if (prevTransactions) {
                        allParts.forEach(part => {
                            let stock = 0;
                            prevTransactions
                                .filter(t => t.part_number === part.part_number)
                                .forEach(trans => {
                                    if (trans.transaction_type === 'INBOUND') {
                                        stock += trans.quantity;
                                    } else if (trans.transaction_type === 'OUTBOUND') {
                                        stock -= Math.abs(trans.quantity);
                                    } else if (trans.transaction_type === 'ADJUSTMENT') {
                                        stock += trans.quantity;
                                    }
                                });
                            previousStockMap.set(part.part_number, stock);
                        });
                    }
                }
            } catch (error) {
                console.warn('전날 재고 계산 오류:', error);
            }

            // 각 날짜별로 재고 계산
            dateList.forEach((date, index) => {
                partDataMap.forEach((partData, partNumber) => {
                    // dateData가 없으면 기본값으로 초기화
                    if (!partData.dates[date]) {
                        partData.dates[date] = {
                            inbound: 0,
                            outbound: 0,
                            adjustment: 0
                        };
                    }

                    const dateData = partData.dates[date];
                    let currentStock;

                    if (index === 0) {
                        // 첫 날: 전날 재고 + 입고 - 출고 + 조정
                        currentStock = (previousStockMap.get(partNumber) || 0) + (dateData.inbound || 0) - (dateData.outbound || 0) + (dateData.adjustment || 0);
                    } else {
                        // 이후 날: 전날 재고 + 입고 - 출고 + 조정
                        const prevDate = dateList[index - 1];
                        const prevDateData = partData.dates[prevDate];
                        if (!prevDateData) {
                            console.warn(`이전 날짜(${prevDate}) 데이터가 없습니다. 파트: ${partNumber}`);
                            // 이전 날짜 데이터가 없으면 기본값 사용
                            partData.dates[prevDate] = {
                                inbound: 0,
                                outbound: 0,
                                adjustment: 0,
                                stock: previousStockMap.get(partNumber) || 0
                            };
                        }
                        const prevStock = (prevDateData?.stock || previousStockMap.get(partNumber) || 0);
                        currentStock = prevStock + (dateData.inbound || 0) - (dateData.outbound || 0) + (dateData.adjustment || 0);
                    }

                    dateData.stock = currentStock;
                });
            });

            // 6. 데이터 저장 및 렌더링
            this.dailyInOutData = Array.from(partDataMap.values());
            this.dailyInOutDateList = dateList; // 엑셀 다운로드용 날짜 목록 저장

            // 디버깅: 데이터 확인
            console.log('일자별 입출고 데이터:', {
                totalParts: this.dailyInOutData.length,
                dateRange: `${startDate} ~ ${endDate}`,
                sampleData: this.dailyInOutData.slice(0, 3).map(p => ({
                    part: p.part_number,
                    firstDate: Object.keys(p.dates)[0],
                    firstDateData: p.dates[Object.keys(p.dates)[0]]
                }))
            });

            this.renderDailyStockTable(dateList); // 재고 현황만 표시하는 표 (상단)
            this.renderDailyInOutTable(dateList); // 입출고 상세 표 (하단)

            // 엑셀 다운로드 버튼 표시
            const exportBtn = document.getElementById('exportDailyInOutExcelBtn');
            if (exportBtn) {
                exportBtn.style.display = 'inline-block';
            }

            this.showNotification(`${startDate} ~ ${endDate} 일자별 입출고 현황을 조회했습니다.`, 'success');

        } catch (error) {
            console.error('일자별 입출고 현황 조회 오류:', error);
            this.showNotification('일자별 입출고 현황 조회 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 일자별 재고 현황 테이블 렌더링 (재고만 표시)
    renderDailyStockTable(dateList) {
        const container = document.getElementById('dailyStockTableContainer');
        if (!container) return;

        if (this.dailyInOutData.length === 0) {
            container.innerHTML = '<div class="px-6 py-4 text-center text-gray-500">데이터가 없습니다.</div>';
            return;
        }

        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-white/20';

        // 헤더 생성
        const thead = document.createElement('thead');
        thead.className = 'bg-white/10';
        const headerRow = document.createElement('tr');

        // 파트 번호 헤더
        const partHeader = document.createElement('th');
        partHeader.className = 'px-4 py-3 text-left text-xs font-medium text-gray-800/80 uppercase tracking-wider sticky left-0 bg-white/10 z-10';
        partHeader.textContent = '파트 번호';
        headerRow.appendChild(partHeader);

        // 각 날짜별 헤더 (재고만)
        dateList.forEach(date => {
            const dateHeader = document.createElement('th');
            dateHeader.className = 'px-3 py-3 text-center text-xs font-medium text-gray-800/80 uppercase tracking-wider';
            // 날짜에 +1일 추가 (시간대 차이 보정)
            const dateObj = new Date(date);
            dateObj.setDate(dateObj.getDate() + 1);
            dateHeader.innerHTML = `
                <div>${dateObj.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</div>
                <div class="text-xs text-gray-600 mt-1 text-blue-600">재고</div>
            `;
            headerRow.appendChild(dateHeader);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 바디 생성
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white/5 divide-y divide-white/20';

        this.dailyInOutData.forEach(partData => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-white/10';

            // 파트 번호
            const partCell = document.createElement('td');
            partCell.className = 'px-4 py-3 text-sm font-medium text-gray-800 sticky left-0 bg-white/5 z-10';
            partCell.textContent = partData.part_number;
            row.appendChild(partCell);

            // 각 날짜별 재고만 표시
            dateList.forEach(date => {
                const dateData = partData.dates[date] || { stock: 0 };

                const stockCell = document.createElement('td');
                stockCell.className = 'px-3 py-3 text-sm text-center text-blue-600 font-semibold';
                stockCell.textContent = dateData.stock || 0;
                row.appendChild(stockCell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        // 컨테이너에 테이블 추가
        container.innerHTML = '';
        container.appendChild(table);
    }

    // 일자별 입출고 테이블 렌더링
    renderDailyInOutTable(dateList) {
        const container = document.getElementById('dailyInOutTableContainer');
        if (!container) return;

        if (this.dailyInOutData.length === 0) {
            container.innerHTML = '<div class="px-6 py-4 text-center text-gray-500">데이터가 없습니다.</div>';
            return;
        }

        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-white/20';

        // 헤더 생성
        const thead = document.createElement('thead');
        thead.className = 'bg-white/10';
        const headerRow = document.createElement('tr');

        // 파트 번호 헤더
        const partHeader = document.createElement('th');
        partHeader.className = 'px-4 py-3 text-left text-xs font-medium text-gray-800/80 uppercase tracking-wider sticky left-0 bg-white/10 z-10';
        partHeader.textContent = '파트 번호';
        headerRow.appendChild(partHeader);

        // 각 날짜별 헤더 (입고, 출고, 재고)
        dateList.forEach(date => {
            const dateHeader = document.createElement('th');
            dateHeader.className = 'px-2 py-3 text-center text-xs font-medium text-gray-800/80 uppercase tracking-wider';
            dateHeader.colSpan = 3;
            // 날짜에 +1일 추가 (시간대 차이 보정)
            const dateObj = new Date(date);
            dateObj.setDate(dateObj.getDate() + 1);
            dateHeader.innerHTML = `
                <div>${dateObj.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</div>
                <div class="text-xs text-gray-600 mt-1">
                    <span class="text-green-600">입고</span> | 
                    <span class="text-red-600">출고</span> | 
                    <span class="text-blue-600">재고</span>
                </div>
            `;
            headerRow.appendChild(dateHeader);
        });

        thead.appendChild(headerRow);

        // 서브 헤더 (입고, 출고, 재고)
        const subHeaderRow = document.createElement('tr');
        subHeaderRow.className = 'bg-white/5';

        // 파트 번호 열 (빈 칸)
        const emptySubHeader = document.createElement('th');
        emptySubHeader.className = 'px-4 py-2 sticky left-0 bg-white/5 z-10';
        subHeaderRow.appendChild(emptySubHeader);

        // 각 날짜별 서브 헤더
        dateList.forEach(() => {
            ['입고', '출고', '재고'].forEach((label, idx) => {
                const subHeader = document.createElement('th');
                subHeader.className = 'px-2 py-2 text-center text-xs font-medium text-gray-700';
                if (idx === 0) subHeader.classList.add('text-green-600');
                else if (idx === 1) subHeader.classList.add('text-red-600');
                else subHeader.classList.add('text-blue-600');
                subHeader.textContent = label;
                subHeaderRow.appendChild(subHeader);
            });
        });

        thead.appendChild(subHeaderRow);
        table.appendChild(thead);

        // 바디 생성
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white/5 divide-y divide-white/20';

        this.dailyInOutData.forEach(partData => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-white/10';

            // 파트 번호
            const partCell = document.createElement('td');
            partCell.className = 'px-4 py-3 text-sm font-medium text-gray-800 sticky left-0 bg-white/5 z-10';
            partCell.textContent = partData.part_number;
            row.appendChild(partCell);

            // 각 날짜별 데이터
            dateList.forEach(date => {
                const dateData = partData.dates[date] || { inbound: 0, outbound: 0, stock: 0, adjustment: 0 };

                // 입고
                const inboundCell = document.createElement('td');
                inboundCell.className = 'px-2 py-3 text-sm text-center text-green-600';
                inboundCell.textContent = dateData.inbound || 0;
                row.appendChild(inboundCell);

                // 출고
                const outboundCell = document.createElement('td');
                outboundCell.className = 'px-2 py-3 text-sm text-center text-red-600';
                outboundCell.textContent = dateData.outbound || 0;
                row.appendChild(outboundCell);

                // 재고
                const stockCell = document.createElement('td');
                stockCell.className = 'px-2 py-3 text-sm text-center text-blue-600 font-semibold';
                stockCell.textContent = dateData.stock || 0;
                row.appendChild(stockCell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        // 컨테이너에 테이블 추가
        container.innerHTML = '';
        container.appendChild(table);
    }

    // 일자별 입출고 현황 엑셀 다운로드 (ExcelJS 사용)
    async exportDailyInOutExcel() {
        if (!this.dailyInOutData || this.dailyInOutData.length === 0) {
            this.showNotification('다운로드할 데이터가 없습니다. 먼저 조회해주세요.', 'error');
            return;
        }

        if (!this.dailyInOutDateList || this.dailyInOutDateList.length === 0) {
            this.showNotification('날짜 정보가 없습니다. 먼저 조회해주세요.', 'error');
            return;
        }

        try {
            this.showLoading(true);

            // ExcelJS 라이브러리 확인
            if (typeof ExcelJS === 'undefined') {
                throw new Error('ExcelJS 라이브러리가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
            }

            // 워크북 생성
            const workbook = new ExcelJS.Workbook();

            // 날짜 형식 변환 함수 (mm/dd) - +1일 추가 (시간대 차이 보정)
            const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                date.setDate(date.getDate() + 1); // +1일 추가
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${month}/${day}`;
            };

            // 시트 1: 일자별 재고 현황
            const worksheetStock = workbook.addWorksheet('일자별 재고 현황');

            // 헤더 행 생성
            const stockHeader = ['파트 번호'];
            this.dailyInOutDateList.forEach(date => {
                stockHeader.push(formatDate(date));
            });
            worksheetStock.addRow(stockHeader);

            // 헤더 스타일링
            const headerRow = worksheetStock.getRow(1);
            headerRow.eachCell((cell, colNumber) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' }
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true,
                    size: 11
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // 데이터 행 추가 및 스타일링
            this.dailyInOutData.forEach((partData, rowIndex) => {
                const row = [partData.part_number];
                this.dailyInOutDateList.forEach(date => {
                    const dateData = partData.dates[date] || { stock: 0 };
                    row.push(dateData.stock || 0);
                });
                const dataRow = worksheetStock.addRow(row);

                dataRow.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' }
                    };
                    cell.font = {
                        size: 10,
                        color: colNumber === 1 ? { argb: 'FF000000' } : { argb: 'FF0066CC' },
                        bold: colNumber > 1
                    };
                    cell.alignment = {
                        horizontal: colNumber === 1 ? 'left' : 'center',
                        vertical: 'middle'
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // 컬럼 너비 설정
            worksheetStock.getColumn(1).width = 15;
            for (let i = 2; i <= this.dailyInOutDateList.length + 1; i++) {
                worksheetStock.getColumn(i).width = 10;
            }

            // 시트 2: 일자별 입출고 상세
            const worksheetInOut = workbook.addWorksheet('일자별 입출고 상세');
            let currentRow = 1;

            // 입고 구역
            const inboundTitleRow = worksheetInOut.addRow(['입고 현황', ...Array(this.dailyInOutDateList.length).fill('')]);
            inboundTitleRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFC6E0B4' }
            };
            inboundTitleRow.getCell(1).font = {
                bold: true,
                size: 12
            };
            inboundTitleRow.getCell(1).border = {
                top: { style: 'medium' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
            currentRow++;

            // 입고 헤더
            const inboundHeader = ['파트 번호'];
            this.dailyInOutDateList.forEach(date => {
                inboundHeader.push(formatDate(date));
            });
            const inboundHeaderRow = worksheetInOut.addRow(inboundHeader);
            inboundHeaderRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF70AD47' }
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true,
                    size: 11
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            currentRow++;

            // 입고 데이터
            this.dailyInOutData.forEach((partData, rowIndex) => {
                const row = [partData.part_number];
                this.dailyInOutDateList.forEach(date => {
                    const dateData = partData.dates[date] || { inbound: 0 };
                    row.push(dateData.inbound || 0);
                });
                const dataRow = worksheetInOut.addRow(row);
                dataRow.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: rowIndex % 2 === 0 ? 'FFE2EFDA' : 'FFFFFFFF' }
                    };
                    cell.font = {
                        color: { argb: 'FF006100' },
                        size: 10
                    };
                    cell.alignment = {
                        horizontal: colNumber === 1 ? 'left' : 'center',
                        vertical: 'middle'
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                currentRow++;
            });

            // 빈 행 2개
            worksheetInOut.addRow([]);
            worksheetInOut.addRow([]);
            currentRow += 2;

            // 출고 구역
            const outboundTitleRow = worksheetInOut.addRow(['출고 현황', ...Array(this.dailyInOutDateList.length).fill('')]);
            outboundTitleRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF4B084' }
            };
            outboundTitleRow.getCell(1).font = {
                bold: true,
                size: 12
            };
            outboundTitleRow.getCell(1).border = {
                top: { style: 'medium' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
            currentRow++;

            // 출고 헤더
            const outboundHeader = ['파트 번호'];
            this.dailyInOutDateList.forEach(date => {
                outboundHeader.push(formatDate(date));
            });
            const outboundHeaderRow = worksheetInOut.addRow(outboundHeader);
            outboundHeaderRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFC00000' }
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true,
                    size: 11
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            currentRow++;

            // 출고 데이터
            this.dailyInOutData.forEach((partData, rowIndex) => {
                const row = [partData.part_number];
                this.dailyInOutDateList.forEach(date => {
                    const dateData = partData.dates[date] || { outbound: 0 };
                    row.push(dateData.outbound || 0);
                });
                const dataRow = worksheetInOut.addRow(row);
                dataRow.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFE699' : 'FFFFFFFF' }
                    };
                    cell.font = {
                        color: { argb: 'FFC00000' },
                        size: 10
                    };
                    cell.alignment = {
                        horizontal: colNumber === 1 ? 'left' : 'center',
                        vertical: 'middle'
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                currentRow++;
            });

            // 빈 행 2개
            worksheetInOut.addRow([]);
            worksheetInOut.addRow([]);
            currentRow += 2;

            // 재고 구역
            const stockTitleRow = worksheetInOut.addRow(['재고 현황', ...Array(this.dailyInOutDateList.length).fill('')]);
            stockTitleRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFBDD7EE' }
            };
            stockTitleRow.getCell(1).font = {
                bold: true,
                size: 12
            };
            stockTitleRow.getCell(1).border = {
                top: { style: 'medium' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
            currentRow++;

            // 재고 헤더
            const stockHeader2 = ['파트 번호'];
            this.dailyInOutDateList.forEach(date => {
                stockHeader2.push(formatDate(date));
            });
            const stockHeaderRow2 = worksheetInOut.addRow(stockHeader2);
            stockHeaderRow2.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' }
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true,
                    size: 11
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            currentRow++;

            // 재고 데이터
            this.dailyInOutData.forEach((partData, rowIndex) => {
                const row = [partData.part_number];
                this.dailyInOutDateList.forEach(date => {
                    const dateData = partData.dates[date] || { stock: 0 };
                    row.push(dateData.stock || 0);
                });
                const dataRow = worksheetInOut.addRow(row);
                dataRow.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: rowIndex % 2 === 0 ? 'FFD9E1F2' : 'FFFFFFFF' }
                    };
                    cell.font = {
                        color: { argb: 'FF0066CC' },
                        bold: true,
                        size: 10
                    };
                    cell.alignment = {
                        horizontal: colNumber === 1 ? 'left' : 'center',
                        vertical: 'middle'
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                currentRow++;
            });

            // 컬럼 너비 설정
            worksheetInOut.getColumn(1).width = 15;
            for (let i = 2; i <= this.dailyInOutDateList.length + 1; i++) {
                worksheetInOut.getColumn(i).width = 10;
            }

            // 파일명 생성
            const startDate = document.getElementById('dailyInOutStartDate').value;
            const endDate = document.getElementById('dailyInOutEndDate').value;
            const fileName = `일자별입출고현황_${startDate}_${endDate}.xlsx`;

            // 파일 다운로드
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            window.URL.revokeObjectURL(url);

            this.showNotification('엑셀 파일이 다운로드되었습니다.', 'success');

        } catch (error) {
            console.error('엑셀 다운로드 오류:', error);
            this.showNotification(`엑셀 다운로드 중 오류가 발생했습니다: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 일자별 재고 현황 엑셀 스타일링
    applyDailyExcelStyling(ws, totalRows, totalCols) {
        // 모든 셀에 테두리 및 스타일 적용
        for (let row = 0; row < totalRows; row++) {
            for (let col = 0; col < totalCols; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                if (!ws[cellRef]) continue;

                if (row === 0) {
                    // 헤더 행
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: "4472C4" } },
                        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                } else {
                    // 데이터 행
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: row % 2 === 0 ? "FFFFFF" : "F2F2F2" } },
                        font: { sz: 10 },
                        alignment: {
                            horizontal: col === 0 ? "left" : "center",
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "CCCCCC" } },
                            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                            left: { style: "thin", color: { rgb: "CCCCCC" } },
                            right: { style: "thin", color: { rgb: "CCCCCC" } }
                        }
                    };

                    // 재고 열은 파란색, 굵게
                    if (col > 0) {
                        ws[cellRef].s.font.color = { rgb: "0066CC" };
                        ws[cellRef].s.font.bold = true;
                    }
                }
            }
        }
    }

    // 일자별 입출고 상세 엑셀 스타일링
    applyDailyInOutExcelStyling(ws, data, partCount) {
        const totalRows = data.length;
        const totalCols = data[0] ? data[0].length : 0;

        let currentRow = 0;

        // 입고 구역
        currentRow++; // 빈 행
        // 제목 행
        for (let col = 0; col < totalCols; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            if (ws[cellRef]) {
                if (col === 0) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: "C6E0B4" } },
                        font: { color: { rgb: "000000" }, bold: true, sz: 12 },
                        alignment: { horizontal: "left", vertical: "center" },
                        border: {
                            top: { style: "medium", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                }
            }
        }
        currentRow++;

        // 입고 헤더
        for (let col = 0; col < totalCols; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: "70AD47" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
        }
        currentRow++;

        // 입고 데이터
        for (let i = 0; i < partCount; i++) {
            for (let col = 0; col < totalCols; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
                if (ws[cellRef]) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: i % 2 === 0 ? "E2EFDA" : "FFFFFF" } },
                        font: { color: { rgb: "006100" }, sz: 10 },
                        alignment: {
                            horizontal: col === 0 ? "left" : "center",
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "CCCCCC" } },
                            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                            left: { style: "thin", color: { rgb: "CCCCCC" } },
                            right: { style: "thin", color: { rgb: "CCCCCC" } }
                        }
                    };
                }
            }
            currentRow++;
        }

        // 빈 행 2개
        currentRow += 2;

        // 출고 구역
        // 제목 행
        for (let col = 0; col < totalCols; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            if (ws[cellRef]) {
                if (col === 0) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: "F4B084" } },
                        font: { color: { rgb: "000000" }, bold: true, sz: 12 },
                        alignment: { horizontal: "left", vertical: "center" },
                        border: {
                            top: { style: "medium", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                }
            }
        }
        currentRow++;

        // 출고 헤더
        for (let col = 0; col < totalCols; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: "C00000" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
        }
        currentRow++;

        // 출고 데이터
        for (let i = 0; i < partCount; i++) {
            for (let col = 0; col < totalCols; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
                if (ws[cellRef]) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: i % 2 === 0 ? "FFE699" : "FFFFFF" } },
                        font: { color: { rgb: "C00000" }, sz: 10 },
                        alignment: {
                            horizontal: col === 0 ? "left" : "center",
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "CCCCCC" } },
                            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                            left: { style: "thin", color: { rgb: "CCCCCC" } },
                            right: { style: "thin", color: { rgb: "CCCCCC" } }
                        }
                    };
                }
            }
            currentRow++;
        }

        // 빈 행 2개
        currentRow += 2;

        // 재고 구역
        // 제목 행
        for (let col = 0; col < totalCols; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            if (ws[cellRef]) {
                if (col === 0) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: "BDD7EE" } },
                        font: { color: { rgb: "000000" }, bold: true, sz: 12 },
                        alignment: { horizontal: "left", vertical: "center" },
                        border: {
                            top: { style: "medium", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                }
            }
        }
        currentRow++;

        // 재고 헤더
        for (let col = 0; col < totalCols; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: "4472C4" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
        }
        currentRow++;

        // 재고 데이터
        for (let i = 0; i < partCount; i++) {
            for (let col = 0; col < totalCols; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: col });
                if (ws[cellRef]) {
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: i % 2 === 0 ? "D9E1F2" : "FFFFFF" } },
                        font: { color: { rgb: "0066CC" }, bold: true, sz: 10 },
                        alignment: {
                            horizontal: col === 0 ? "left" : "center",
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "CCCCCC" } },
                            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                            left: { style: "thin", color: { rgb: "CCCCCC" } },
                            right: { style: "thin", color: { rgb: "CCCCCC" } }
                        }
                    };
                }
            }
            currentRow++;
        }
    }

    renderDateStockTable() {
        const tbody = document.getElementById('dateStockTableBody');
        const fragment = document.createDocumentFragment();

        if (this.dateStockData.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    계산된 데이터가 없습니다.
                </td>
            `;
            fragment.appendChild(noDataRow);
        } else {
            this.dateStockData.forEach(item => {
                const row = document.createElement('tr');

                // 입고/출고/조정이 0이면 "-"로 표시
                const inboundDisplay = item.daily_inbound > 0 ? `+${item.daily_inbound}` : '-';
                const outboundDisplay = item.daily_outbound > 0 ? `-${item.daily_outbound}` : '-';
                const adjustmentDisplay = item.daily_adjustment !== 0
                    ? (item.daily_adjustment > 0 ? `+${item.daily_adjustment}` : `${item.daily_adjustment}`)
                    : '-';

                // 전날 재고와 금일 재고가 다른지 확인
                const isChanged = item.previous_stock !== item.calculated_stock;
                const stockClass = isChanged ? 'text-blue-600 font-bold' : 'text-gray-900';
                const stockBg = isChanged ? 'bg-blue-50' : '';

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${item.part_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.previous_stock}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${item.daily_inbound > 0 ? 'text-green-600' : 'text-gray-400'}">${inboundDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${item.daily_outbound > 0 ? 'text-red-600' : 'text-gray-400'}">${outboundDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${item.daily_adjustment !== 0 ? (item.daily_adjustment > 0 ? 'text-purple-600' : 'text-orange-600') : 'text-gray-400'}">${adjustmentDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${stockClass} ${stockBg}">${item.calculated_stock}</td>
                `;
                fragment.appendChild(row);
            });
        }

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    sortDateStockTable(column) {
        if (this.dateStockSortColumn === column) {
            this.dateStockSortDirection = this.dateStockSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.dateStockSortColumn = column;
            this.dateStockSortDirection = 'asc';
        }

        this.updateDateStockSortIcons();

        this.dateStockData.sort((a, b) => {
            let aValue = a[column];
            let bValue = b[column];

            if (aValue === null || aValue === undefined) aValue = 0;
            if (bValue === null || bValue === undefined) bValue = 0;

            if (typeof aValue === 'number') {
                return this.dateStockSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }

            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();

            if (this.dateStockSortDirection === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });

        this.renderDateStockTable();
    }

    updateDateStockSortIcons() {
        const columns = ['part_number', 'previous_stock', 'daily_inbound', 'daily_outbound', 'daily_adjustment', 'calculated_stock'];
        columns.forEach(col => {
            const icon = document.getElementById(`dateSortIcon_${col}`);
            if (icon) {
                icon.className = 'fas fa-sort ml-1 text-gray-400';
            }
        });

        if (this.dateStockSortColumn) {
            const icon = document.getElementById(`dateSortIcon_${this.dateStockSortColumn}`);
            if (icon) {
                if (this.dateStockSortDirection === 'asc') {
                    icon.className = 'fas fa-sort-up ml-1 text-blue-600';
                } else {
                    icon.className = 'fas fa-sort-down ml-1 text-blue-600';
                }
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryStatus = new InventoryStatus();
}); 