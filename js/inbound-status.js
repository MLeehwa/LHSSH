// Inbound Status JavaScript - Performance Optimized
// Supabase는 CDN으로 불러옴 (전역 객체 사용)

class InboundStatus {
    constructor() {
        this.containers = [];
        this.parts = [];
        this.masterParts = []; // 마스터 파트 데이터 (드롭다운용)
        this.filteredContainers = [];
        this.selectedContainer = null;
        this.filterTimeout = null; // 디바운싱을 위한 타이머
        this.selectedFile = null; // 선택된 파일
        this.fileData = null; // 파싱된 파일 데이터
        
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

    // 한국 시간을 미국 중부 시간으로 변환
    convertToCentralTime(koreanDate) {
        try {
            // 입력된 날짜가 유효한지 확인
            if (!koreanDate || koreanDate.trim() === '') {
                return new Date().toISOString().split('T')[0];
            }
            
            // 다양한 날짜 형식 처리
            let date;
            const cleanDate = koreanDate.trim();
            
            // YYYY-MM-DD 형식인 경우
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                date = new Date(cleanDate + 'T00:00:00+09:00');
            }
            // YYYY/MM/DD 형식인 경우
            else if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleanDate)) {
                const parts = cleanDate.split('/');
                date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00+09:00`);
            }
            // MM/DD/YYYY 형식인 경우
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDate)) {
                const parts = cleanDate.split('/');
                date = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00+09:00`);
            }
            // 기타 형식은 그대로 사용
            else {
                date = new Date(cleanDate);
            }
            
            // 날짜가 유효한지 확인
            if (isNaN(date.getTime())) {
                console.warn('유효하지 않은 날짜 형식:', koreanDate);
                return new Date().toISOString().split('T')[0];
            }
            
            // 미국 중부 시간대로 변환
            const centralTime = new Date(date.toLocaleString('en-US', {
                timeZone: 'America/Chicago'
            }));
            
            // YYYY-MM-DD 형식으로 반환
            return centralTime.toISOString().split('T')[0];
        } catch (error) {
            console.error('시간 변환 오류:', error);
            return new Date().toISOString().split('T')[0]; // 오류 시 오늘 날짜 반환
        }
    }

    // 미국 중부 시간을 한국 시간으로 변환 (표시용)
    convertToKoreanTime(centralDate) {
        try {
            // 미국 중부 시간으로 Date 객체 생성
            const date = new Date(centralDate + 'T00:00:00-06:00');
            
            // 한국 시간대로 변환
            const koreanTime = new Date(date.toLocaleString('en-US', {
                timeZone: 'Asia/Seoul'
            }));
            
            // YYYY-MM-DD 형식으로 반환
            return koreanTime.toISOString().split('T')[0];
        } catch (error) {
            console.error('시간 변환 오류:', error);
            return centralDate; // 변환 실패 시 원본 반환
        }
    }

    // 파트 번호에서 마지막 알파벳 제거
    removeTrailingAlphabet(partNumber) {
        if (!partNumber || typeof partNumber !== 'string') {
            return partNumber;
        }
        
        // 마지막 문자가 알파벳인지 확인하고 제거
        const trimmedPartNumber = partNumber.trim();
        if (trimmedPartNumber.length > 0) {
            const lastChar = trimmedPartNumber.charAt(trimmedPartNumber.length - 1);
            if (/[a-zA-Z]/.test(lastChar)) {
                return trimmedPartNumber.slice(0, -1);
            }
        }
        
        return trimmedPartNumber;
    }

    // 파트 번호로 카테고리 결정
    determineCategory(partNumber) {
        if (!partNumber) return 'INNER';
        
        const cleanPartNumber = this.removeTrailingAlphabet(partNumber).toString().trim();
        if (cleanPartNumber.startsWith('4960')) {
            return 'REAR';
        } else {
            return 'INNER';
        }
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

    // 연결 테스트
    async testConnection() {
        try {
            console.log('Supabase 연결 테스트 시작...');
            
            // 먼저 기본 연결 테스트
            const { data, error } = await this.supabase
                .from('arn_containers')
                .select('*')
                .limit(1);
            
            if (error) {
                console.error('Supabase 연결 테스트 실패:', error);
                console.error('오류 코드:', error.code);
                console.error('오류 메시지:', error.message);
                console.error('오류 상세:', error.details);
                
                // 406 오류인 경우 추가 디버깅
                if (error.code === '406') {
                    console.error('406 오류 감지 - 헤더 또는 인증 문제일 수 있습니다.');
                    console.error('현재 Supabase 클라이언트 설정:', this.supabase);
                }
                
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

    async init() {
        try {
            console.log('InboundStatus 초기화 시작...');
            
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
            
            console.log('InboundStatus 초기화 완료');
        } catch (error) {
            console.error('InboundStatus 초기화 오류:', error);
            this.loadMockData();
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
        const container = document.getElementById('inboundStatusContainer') || document.body;
        
        // Single event listener for all interactions
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
            } else if (e.target.matches('#manualRegisterBtn')) {
                this.showManualRegisterModal();
            } else if (e.target.matches('#exportBtn')) {
                this.toggleExportDropdown();
            } else if (e.target.matches('#exportCSVBtn')) {
                this.exportData('csv');
                this.hideExportDropdown();
            } else if (e.target.matches('#exportExcelBtn')) {
                this.exportData('excel');
                this.hideExportDropdown();
            } else if (e.target.matches('[data-action="inbound"]')) {
                // Inbound button click
                const arnNumber = e.target.getAttribute('data-arn');
                const containerNumber = e.target.getAttribute('data-container');
                this.showInboundDateModal(arnNumber, containerNumber);
            } else if (e.target.matches('[data-action="edit"]')) {
                // Edit button click
                e.stopPropagation();
                const arnNumber = e.target.getAttribute('data-arn');
                this.editContainer(arnNumber);
            } else if (e.target.matches('[data-action="delete"]')) {
                // Delete button click
                e.stopPropagation();
                const arnNumber = e.target.getAttribute('data-arn');
                const containerNumber = e.target.getAttribute('data-container');
                this.deleteContainer(arnNumber, containerNumber);
            } else if (e.target.closest('[data-action="select-container"]')) {
                // Container row click
                const row = e.target.closest('[data-action="select-container"]');
                const arnNumber = row.getAttribute('data-arn');
                this.selectContainer(arnNumber);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#exportBtn')) {
                this.hideExportDropdown();
            }
        });

        // Input events
        container.addEventListener('input', (e) => {
            if (e.target.matches('#partNumberFilter')) {
                this.debouncedApplyFilters();
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target.matches('#dateFilter, #statusFilter')) {
                this.applyFilters();
            }
        });

        // Manual refresh button
        container.addEventListener('click', (e) => {
            if (e.target.matches('#refreshData')) {
                e.preventDefault();
                this.refreshData();
            }
        });

        // Modal events
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
            { selector: '#cancelManualRegister, #cancelManualRegisterBtn', action: () => this.closeManualRegisterModal() },
            { selector: '#addPartBtn', action: () => this.addPartField() },
            { selector: '#cancelContainerEditBtn, #cancelContainerEdit', action: () => this.closeContainerEditModal() },
            { selector: '#cancelContainerDeleteBtn, #cancelContainerDelete', action: () => this.closeContainerDeleteModal() },
            { selector: '#cancelInboundDateBtn, #cancelInboundDate', action: () => this.closeInboundDateModal() },
            { selector: '#confirmContainerDelete', action: () => this.submitContainerDelete() },
            { selector: '#confirmInboundDate', action: () => this.submitInboundDate() }
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
            if (e.target.matches('#manualRegisterForm')) {
                e.preventDefault();
                this.submitManualRegistration();
            }
            if (e.target.matches('#containerEditForm')) {
                e.preventDefault();
                this.submitContainerEdit();
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
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    }

    hideExportDropdown() {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
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
                console.warn('Supabase 클라이언트가 초기화되지 않았습니다. Mock 데이터를 사용합니다.');
                this.loadMockData();
                return;
            }
            
            // Performance: Load data in parallel
            const [containersResult, partsResult, masterPartsResult] = await Promise.all([
                this.loadContainerData(),
                this.loadPartsData(),
                this.loadMasterPartsData()
            ]);
            
            this.containers = containersResult;
            this.parts = partsResult;
            this.masterParts = masterPartsResult;
            this.filteredContainers = [...this.containers];
            
            this.lastDataUpdate = now;
            this.cache.clear();
            
            console.log('데이터 로드 완료. 총 컨테이너:', this.containers.length, '총 파트:', this.parts.length);
            
            this.renderContainers();
            this.updateStats();
            
        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            this.loadMockData();
        } finally {
            this.isLoading = false;
        }
    }

    async refreshData() {
        console.log('데이터 새로고침 시작...');
        
        // 새로고침 버튼에 로딩 상태 표시
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>새로고침 중...';
            refreshBtn.disabled = true;
        }
        
        try {
            // 강제 새로고침을 위한 상태 초기화
            this.lastDataUpdate = 0; // 캐시 무효화
            this.cache.clear();
            this.isLoading = false; // 로딩 상태 초기화
            
            // 데이터 로딩
            await this.loadData();
            
            // 필터 재적용
            this.applyFilters();
            
            // 통계 업데이트
            this.updateStats();
            
            console.log('데이터 새로고침 완료');
            this.showNotification('데이터가 새로고침되었습니다.', 'success');
        } catch (error) {
            console.error('데이터 새로고침 오류:', error);
            this.showNotification('데이터 새로고침 중 오류가 발생했습니다.', 'error');
        } finally {
            // 새로고침 버튼 상태 복원
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>새로고침';
                refreshBtn.disabled = false;
            }
        }
    }

    exportData(format) {
        if (format === 'csv') {
            this.exportToCSV();
        } else if (format === 'excel') {
            this.exportToExcel();
        }
    }

    exportToCSV() {
        const headers = ['도착일', '컨테이너 번호', '상태', '완료된 파트', 'ARN 번호'];
        const csvContent = [
            headers.join(','),
            ...this.filteredContainers.map(container => {
                const partsForContainer = this.parts.filter(part => 
                    part.arn_number === container.arn_number
                );
                const completedParts = partsForContainer.filter(part => 
                    part.status === 'COMPLETED'
                ).length;
                const totalParts = partsForContainer.length;
                
                return [
                    this.convertToKoreanTime(container.arrival_date),
                    container.container_number,
                    container.status,
                    `${completedParts}/${totalParts}`,
                    container.arn_number
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inbound_status_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    exportToExcel() {
        // ExcelJS 라이브러리가 로드되어 있는지 확인
        if (typeof ExcelJS === 'undefined') {
            this.showNotification('ExcelJS 라이브러리가 로드되지 않았습니다.', 'error');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('입고 현황');

        // 헤더 추가
        worksheet.addRow(['도착일', '컨테이너 번호', '상태', '완료된 파트', 'ARN 번호']);

        // 데이터 추가
        this.filteredContainers.forEach(container => {
            const partsForContainer = this.parts.filter(part => 
                part.arn_number === container.arn_number
            );
            const completedParts = partsForContainer.filter(part => 
                part.status === 'COMPLETED'
            ).length;
            const totalParts = partsForContainer.length;
            
            worksheet.addRow([
                this.convertToKoreanTime(container.arrival_date),
                container.container_number,
                container.status,
                `${completedParts}/${totalParts}`,
                container.arn_number
            ]);
        });

        // 스타일 적용
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // 파일 다운로드
        workbook.xlsx.writeBuffer().then(buffer => {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `inbound_status_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();
        });
    }

    async loadContainerData() {
        const cacheKey = 'container_data';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data, error } = await this.supabase
            .from('arn_containers')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('컨테이너 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    async loadPartsData() {
        const cacheKey = 'parts_data';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data, error } = await this.supabase
            .from('arn_parts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('파트 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    async loadMasterPartsData() {
        const cacheKey = 'master_parts_data';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data, error } = await this.supabase
            .from('parts')
            .select('part_number')
            .eq('status', 'ACTIVE')
            .order('part_number');
        
        if (error) {
            console.error('마스터 파트 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    loadMockData() {
        // 모의 데이터 로드 (연결 실패 시)
        this.containers = [
            {
                id: 1,
                arn_number: 'ARN-2024-001',
                container_number: 'CONT001',
                supplier: '공급업체 A',
                arrival_date: '2024-01-15',
                status: 'PENDING',
                created_at: '2024-01-15T10:00:00Z'
            },
            {
                id: 2,
                arn_number: 'ARN-2024-002',
                container_number: 'CONT002',
                supplier: '공급업체 B',
                arrival_date: '2024-01-16',
                status: 'COMPLETED',
                created_at: '2024-01-16T10:00:00Z'
            }
        ];

        this.parts = [
            {
                id: 1,
                arn_number: 'ARN-2024-001',
                part_number: '49560-12345',
                quantity: 100,
                scanned_quantity: 0,
                status: 'PENDING',
                created_at: '2024-01-15T10:00:00Z'
            },
            {
                id: 2,
                arn_number: 'ARN-2024-001',
                part_number: '49600-67890',
                quantity: 50,
                scanned_quantity: 50,
                status: 'COMPLETED',
                created_at: '2024-01-15T10:00:00Z'
            }
        ];

        this.masterParts = [
            { part_number: '49560-12345' },
            { part_number: '49600-67890' },
            { part_number: '49560-11111' },
            { part_number: '49601-22222' }
        ];

        this.filteredContainers = [...this.containers];
        this.renderContainers();
        this.updateStats();
    }

    debouncedApplyFilters() {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this.filterTimeout = setTimeout(() => {
            this.applyFilters();
        }, 150);
    }

    applyFilters() {
        const dateFilter = document.getElementById('dateFilter').value;
        const containerFilter = document.getElementById('containerFilter').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredContainers = this.containers.filter(container => {
            const dateMatch = !dateFilter || container.arrival_date === dateFilter;
            const containerMatch = !containerFilter || 
                container.container_number.toLowerCase().includes(containerFilter) ||
                container.arn_number.toLowerCase().includes(containerFilter);
            const statusMatch = !statusFilter || container.status === statusFilter;

            return dateMatch && containerMatch && statusMatch;
        });

        this.renderContainers();
    }

    resetFilters() {
        document.getElementById('dateFilter').value = '';
        document.getElementById('containerFilter').value = '';
        document.getElementById('statusFilter').value = '';
        this.filteredContainers = [...this.containers];
        this.renderContainers();
    }

    renderContainers() {
        const tbody = document.getElementById('containerTableBody');
        
        if (this.filteredContainers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredContainers.map(container => {
            const partsForContainer = this.parts.filter(part => 
                part.arn_number === container.arn_number
            );
            
            const completedParts = partsForContainer.filter(part => 
                part.status === 'COMPLETED'
            ).length;
            
            const totalParts = partsForContainer.length;
            
            const statusColor = container.status === 'COMPLETED' ? 'green' : 
                              container.status === 'IN_PROGRESS' ? 'yellow' : 'gray';
            
            const statusText = container.status === 'COMPLETED' ? '완료' :
                             container.status === 'IN_PROGRESS' ? '진행중' : '대기';

            // 컨테이너 입고 버튼
            const inboundButton = container.status === 'COMPLETED' ? 
                `<span class="text-sm text-gray-500">완료됨</span>` :
                `<button data-action="inbound" data-arn="${container.arn_number}" data-container="${container.container_number}" 
                         class="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm transition-colors">
                    <i class="fas fa-arrow-down mr-1"></i>입고
                </button>`;

            // 수정/삭제 버튼 (입고 완료된 컨테이너는 숨김)
            const actionButtons = container.status === 'COMPLETED' ? 
                `<span class="text-xs text-gray-400">수정 불가</span>` :
                `<button data-action="edit" data-arn="${container.arn_number}" 
                         class="text-blue-600 hover:text-blue-900 ml-2" title="수정">
                    <i class="fas fa-edit"></i>
                </button>
                <button data-action="delete" data-arn="${container.arn_number}" data-container="${container.container_number}" 
                         class="text-red-600 hover:text-red-900 ml-2" title="삭제">
                    <i class="fas fa-trash"></i>
                </button>`;

            return `
                <tr class="hover:bg-gray-50 cursor-pointer" data-action="select-container" data-arn="${container.arn_number}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${this.convertToKoreanTime(container.arrival_date)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${container.container_number}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${completedParts}/${totalParts} 파트 완료
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        ${inboundButton}
                        ${actionButtons}
                    </td>
                </tr>
            `;
        }).join('');
    }

    selectContainer(containerId) {
        this.selectedContainer = containerId;
        this.renderParts(containerId);
        
        // 선택된 행 하이라이트
        const rows = document.querySelectorAll('#containerTableBody tr');
        rows.forEach(row => row.classList.remove('bg-blue-50'));
        
        const selectedRow = document.querySelector(`#containerTableBody tr[data-arn="${containerId}"]`);
        if (selectedRow) {
            selectedRow.classList.add('bg-blue-50');
        }
    }

    renderParts(containerId) {
        const tbody = document.getElementById('partsTableBody');
        const partsForContainer = this.parts.filter(part => part.arn_number === containerId);
        const container = this.containers.find(c => c.arn_number === containerId);
        
        if (partsForContainer.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        이 컨테이너에 등록된 파트가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = partsForContainer.map(part => {
            const statusColor = part.status === 'COMPLETED' ? 'green' : 
                              part.status === 'IN_PROGRESS' ? 'yellow' : 'gray';
            
            const statusText = part.status === 'COMPLETED' ? '완료' :
                             part.status === 'IN_PROGRESS' ? '진행중' : '대기';

            // 컨테이너의 입고일을 사용
            const inboundDate = container && container.inbound_date ? 
                this.convertToKoreanTime(container.inbound_date) : '-';

            return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${part.arn_number}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${container ? container.container_number : '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${part.part_number}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${part.quantity}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${inboundDate}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800">
                            ${statusText}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStats() {
        const totalArn = this.containers.length;
        const completedArn = this.containers.filter(c => c.status === 'COMPLETED').length;
        const pendingArn = this.containers.filter(c => c.status === 'PENDING').length;
        const totalParts = this.parts.length;
        const completedParts = this.parts.filter(p => p.status === 'COMPLETED').length;
        const pendingParts = this.parts.filter(p => p.status === 'PENDING').length;

        document.getElementById('totalArn').textContent = totalArn;
        document.getElementById('completedArn').textContent = completedArn;
        document.getElementById('pendingArn').textContent = pendingArn;
        document.getElementById('totalParts').textContent = totalParts;
        document.getElementById('completedParts').textContent = completedParts;
        document.getElementById('pendingParts').textContent = pendingParts;
    }

    // CSV 업로드 관련 메서드들
    showCsvUploadModal() {
        document.getElementById('csvUploadModal').classList.remove('hidden');
        this.resetFileUpload();
    }

    closeCsvUploadModal() {
        document.getElementById('csvUploadModal').classList.add('hidden');
        this.resetFileUpload();
    }

    resetFileUpload() {
        this.selectedFile = null;
        this.fileData = null;
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
                this.handleFile(files[0]);
            }
        });
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        this.selectedFile = file;
        
        // 파일 정보 표시
        document.getElementById('fileInfo').classList.add('hidden');
        document.getElementById('removeFile').classList.remove('hidden');
        
        // 파일 미리보기 생성
        this.createFilePreview(file);
        
        // 파일 파싱
        this.parseFile(file);
    }

    createFilePreview(file) {
        const preview = document.getElementById('filePreview');
        preview.innerHTML = `
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <i class="fas fa-file-excel text-green-600 text-xl mr-3"></i>
                        <div>
                            <p class="font-medium text-gray-900">${file.name}</p>
                            <p class="text-sm text-gray-500">${(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createDataPreview() {
        const preview = document.getElementById('filePreview');
        const existingPreview = preview.querySelector('.bg-gray-50');
        
        // 컬럼 매핑 정보 가져오기
        const mappedColumns = this.getMappedColumns();
        
        const dataPreview = document.createElement('div');
        dataPreview.className = 'mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden';
        
        // 컬럼 매핑 상태에 따라 다른 내용 표시
        if (mappedColumns.allMapped) {
            dataPreview.innerHTML = `
                <div class="px-4 py-3 bg-green-50 border-b border-gray-200">
                    <h4 class="text-sm font-medium text-green-900">✓ 컬럼 매핑 완료 (${this.fileData.length}개 행)</h4>
                    <div class="mt-2 text-xs text-green-700">
                        <span class="mr-4">날짜: ${mappedColumns.dateColumn || '매핑 실패'}</span>
                        <span class="mr-4">컨테이너: ${mappedColumns.containerColumn || '매핑 실패'}</span>
                        <span class="mr-4">파트: ${mappedColumns.partColumn || '매핑 실패'}</span>
                        <span>수량: ${mappedColumns.quantityColumn || '매핑 실패'}</span>
                    </div>
                    <div class="mt-2 text-xs text-blue-700">
                        <i class="fas fa-info-circle mr-1"></i>
                        파트 번호의 마지막 알파벳은 자동으로 제거됩니다.
                    </div>
                    <div class="mt-2 text-xs text-green-700">
                        <i class="fas fa-ship mr-1"></i>
                        각 컨테이너 번호마다 고유한 ARN 번호가 자동으로 부여됩니다.
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">컨테이너</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">원본 파트</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">정리된 파트</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${this.fileData.slice(0, 10).map(row => `
                                <tr>
                                    <td class="px-3 py-2 text-sm text-gray-900">${row.date}</td>
                                    <td class="px-3 py-2 text-sm text-gray-900">${row.container}</td>
                                    <td class="px-3 py-2 text-sm text-gray-500">${row.originalPart}</td>
                                    <td class="px-3 py-2 text-sm text-gray-900 font-medium">${row.part}</td>
                                    <td class="px-3 py-2 text-sm text-gray-900">${row.quantity}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${this.fileData.length > 10 ? `
                    <div class="px-4 py-2 bg-gray-50 border-t border-gray-200">
                        <p class="text-xs text-gray-500">총 ${this.fileData.length}개 행 중 10개 표시</p>
                    </div>
                ` : ''}
            `;
        } else {
            dataPreview.innerHTML = `
                <div class="px-4 py-3 bg-red-50 border-b border-gray-200">
                    <h4 class="text-sm font-medium text-red-900">⚠ 컬럼 매핑 실패</h4>
                    <div class="mt-2 text-xs text-red-700">
                        <p>필요한 컬럼을 찾을 수 없습니다. 다음 컬럼명 중 하나가 필요합니다:</p>
                        <div class="mt-1">
                            <span class="mr-4">날짜: ${mappedColumns.dateColumn || '날짜/Date/도착/Arrival/입고일'}</span>
                            <span class="mr-4">컨테이너: ${mappedColumns.containerColumn || '컨테이너/Container/선박/Ship'}</span>
                            <span class="mr-4">파트: ${mappedColumns.partColumn || '파트/Part/품목/Item'}</span>
                            <span>수량: ${mappedColumns.quantityColumn || '수량/Quantity/QTY'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 기존 미리보기 뒤에 데이터 미리보기 추가
        existingPreview.parentNode.insertBefore(dataPreview, existingPreview.nextSibling);
    }

    getMappedColumns() {
        if (!this.fileData || this.fileData.length === 0) {
            return { allMapped: false };
        }
        
        // 첫 번째 행에서 컬럼명 찾기 (첫 번째 열 제외)
        const firstRow = this.fileData[0];
        const allColumns = Object.keys(firstRow);
        const filteredColumns = allColumns.slice(1);
        
        const dateColumn = this.findColumnFlexible(filteredColumns, ['날짜', 'Date', '도착', 'Arrival', '입고일', 'date', 'arrival', 'arrival_date', 'arrivaldate', '도착일', '입고', 'inbound', 'inbound_date']);
        const containerColumn = this.findColumnFlexible(filteredColumns, ['컨테이너', 'Container', '선박', 'Ship', '컨테이너번호', 'container', 'ship', 'container_number', 'containernumber', '컨테이너 번호', '선박번호', 'ship_number']);
        const partColumn = this.findColumnFlexible(filteredColumns, ['파트', 'Part', '품목', 'Item', '번호', 'Number', '파트번호', 'part', 'item', 'part_number', 'partnumber', '품목번호', '파트 번호', 'partno', 'part_no']);
        const quantityColumn = this.findColumnFlexible(filteredColumns, ['수량', 'Quantity', 'QTY', '개수', 'Amount', 'quantity', 'qty', 'amount', '개수', '수량', 'qty', 'qty.', 'quantity.', 'amount.']);
        
        return {
            allMapped: !!(dateColumn && containerColumn && partColumn && quantityColumn),
            dateColumn,
            containerColumn,
            partColumn,
            quantityColumn
        };
    }

    async parseFile(file) {
        try {
            const data = await this.readFile(file);
            this.fileData = this.parseCsvData(data);
            console.log('파싱된 데이터:', this.fileData);
            
            // 파싱 완료 후 즉시 미리보기 생성
            this.createDataPreview();
        } catch (error) {
            console.error('파일 파싱 오류:', error);
            this.showNotification('파일 파싱 중 오류가 발생했습니다.', 'error');
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = (e) => {
                reject(e);
            };
            
            if (file.name.endsWith('.csv')) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    parseCsvData(data) {
        try {
            let workbook;
            
            if (typeof data === 'string') {
                // CSV 파일인 경우
                const lines = data.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const rows = [];
                
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim()) {
                        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                        const row = {};
                        headers.forEach((header, index) => {
                            row[header] = values[index] || '';
                        });
                        rows.push(row);
                    }
                }
                
                return this.processParsedData(rows);
            } else {
                // Excel 파일인 경우
                workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    throw new Error('데이터가 충분하지 않습니다.');
                }
                
                const headers = jsonData[0];
                const rows = [];
                
                for (let i = 1; i < jsonData.length; i++) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = jsonData[i][index] || '';
                    });
                    rows.push(row);
                }
                
                return this.processParsedData(rows);
            }
        } catch (error) {
            console.error('CSV 파싱 오류:', error);
            throw error;
        }
    }

    processParsedData(rows) {
        const processedData = [];
        
        if (rows.length === 0) {
            return processedData;
        }
        
        // 첫 번째 행에서 컬럼명 찾기 (첫 번째 열 제외)
        const firstRow = rows[0];
        const allColumns = Object.keys(firstRow);
        
        // 첫 번째 열을 제외한 컬럼들만 사용
        const filteredColumns = allColumns.slice(1);
        console.log('전체 컬럼:', allColumns);
        console.log('첫 번째 열 제외 후 컬럼:', filteredColumns);
        
        // 컬럼명 매핑 (더 유연한 매칭) - 첫 번째 열 제외
        const dateColumn = this.findColumnFlexible(filteredColumns, ['날짜', 'Date', '도착', 'Arrival', '입고일', 'date', 'arrival', 'arrival_date', 'arrivaldate', '도착일', '입고', 'inbound', 'inbound_date']);
        const containerColumn = this.findColumnFlexible(filteredColumns, ['컨테이너', 'Container', '선박', 'Ship', '컨테이너번호', 'container', 'ship', 'container_number', 'containernumber', '컨테이너 번호', '선박번호', 'ship_number']);
        const partColumn = this.findColumnFlexible(filteredColumns, ['파트', 'Part', '품목', 'Item', '번호', 'Number', '파트번호', 'part', 'item', 'part_number', 'partnumber', '품목번호', '파트 번호', 'partno', 'part_no']);
        const quantityColumn = this.findColumnFlexible(filteredColumns, ['수량', 'Quantity', 'QTY', '개수', 'Amount', 'quantity', 'qty', 'amount', '개수', '수량', 'qty', 'qty.', 'quantity.', 'amount.']);
        
        console.log('매핑된 컬럼:', { dateColumn, containerColumn, partColumn, quantityColumn });
        
        // 모든 필수 컬럼이 매핑되었는지 확인
        if (!dateColumn || !containerColumn || !partColumn || !quantityColumn) {
            console.warn('일부 컬럼 매핑 실패:', { dateColumn, containerColumn, partColumn, quantityColumn });
            return processedData;
        }
        
        // 전체 행 처리 (헤더 제외, 첫 번째 열 제외)
        rows.forEach((row, index) => {
            const dateValue = row[dateColumn];
            const containerValue = row[containerColumn];
            const partValue = row[partColumn];
            const quantityValue = row[quantityColumn];
            
            // 값이 유효한지 확인
            if (dateValue && containerValue && partValue && quantityValue) {
                // 날짜 형식 검증 및 수정
                const validDate = this.validateAndFixDate(dateValue.toString());
                if (!validDate) {
                    console.warn(`행 ${index + 1}: 유효하지 않은 날짜 형식 - ${dateValue}`);
                    return; // 이 행은 건너뛰기
                }
                
                // 파트 번호에서 마지막 알파벳 제거
                const cleanedPartNumber = this.removeTrailingAlphabet(partValue.toString().trim());
                
                const processedRow = {
                    date: validDate,
                    container: containerValue.toString().trim(),
                    part: cleanedPartNumber,
                    quantity: parseInt(quantityValue) || 0,
                    originalPart: partValue.toString().trim() // 원본 파트 번호 보관
                };
                
                if (processedRow.quantity > 0) {
                    processedData.push(processedRow);
                }
            }
        });
        
        return processedData;
    }

    // 날짜 형식 검증 및 수정
    validateAndFixDate(dateString) {
        try {
            const cleanDate = dateString.trim();
            
            // 이미 유효한 YYYY-MM-DD 형식인 경우
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                return this.convertToCentralTime(cleanDate);
            }
            
            // 이상한 형식의 날짜 처리 (예: +045755-01-01)
            if (cleanDate.includes('+') || cleanDate.includes('-') && cleanDate.length > 10) {
                console.warn('이상한 날짜 형식 감지:', cleanDate);
                // 오늘 날짜로 대체
                return new Date().toISOString().split('T')[0];
            }
            
            // 다양한 날짜 형식 처리
            let date;
            
            // YYYY/MM/DD 형식인 경우
            if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleanDate)) {
                const parts = cleanDate.split('/');
                date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00+09:00`);
            }
            // MM/DD/YYYY 형식인 경우
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDate)) {
                const parts = cleanDate.split('/');
                date = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00+09:00`);
            }
            // 기타 형식은 그대로 사용
            else {
                date = new Date(cleanDate);
            }
            
            // 날짜가 유효한지 확인
            if (isNaN(date.getTime())) {
                console.warn('유효하지 않은 날짜 형식:', cleanDate);
                return new Date().toISOString().split('T')[0]; // 오류 시 오늘 날짜 반환
            }
            
            // 미국 중부 시간대로 변환
            const centralTime = new Date(date.toLocaleString('en-US', {
                timeZone: 'America/Chicago'
            }));
            
            // YYYY-MM-DD 형식으로 반환
            return centralTime.toISOString().split('T')[0];
        } catch (error) {
            console.error('날짜 처리 오류:', error);
            return new Date().toISOString().split('T')[0]; // 오류 시 오늘 날짜 반환
        }
    }

    findColumnFlexible(columns, possibleNames) {
        // 정확한 매칭 먼저 시도
        for (const name of possibleNames) {
            if (columns.includes(name)) {
                return name;
            }
        }
        
        // 부분 매칭 시도 (대소문자 무시)
        for (const column of columns) {
            const lowerColumn = column.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const name of possibleNames) {
                const lowerName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (lowerColumn.includes(lowerName) || lowerName.includes(lowerColumn)) {
                    return column;
                }
            }
        }
        
        return null;
    }

    removeSelectedFile() {
        this.resetFileUpload();
    }

    async uploadFileData() {
        if (!this.fileData || this.fileData.length === 0) {
            this.showNotification('업로드할 데이터가 없습니다.', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            // 데이터 그룹화 (컨테이너별로)
            const containerGroups = this.groupDataByContainer(this.fileData);
            
            // 각 컨테이너별로 데이터 저장
            for (const [containerNumber, parts] of Object.entries(containerGroups)) {
                await this.saveContainerData(containerNumber, parts);
            }
            
            const containerCount = Object.keys(containerGroups).length;
            const totalParts = Object.values(containerGroups).reduce((sum, parts) => sum + parts.length, 0);
            this.showNotification(`${containerCount}개 컨테이너, ${totalParts}개 파트가 성공적으로 등록되었습니다. (컨테이너별 ARN 번호 자동 부여)`, 'success');
            this.closeCsvUploadModal();
            
            // 약간의 지연 후 새로고침
            setTimeout(async () => {
                await this.refreshData();
            }, 500);
            
        } catch (error) {
            console.error('데이터 업로드 오류:', error);
            this.showNotification('데이터 업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    groupDataByContainer(data) {
        const groups = {};
        
        data.forEach(row => {
            if (!groups[row.container]) {
                groups[row.container] = [];
            }
            groups[row.container].push(row);
        });
        
        return groups;
    }

    async saveContainerData(containerNumber, parts) {
        try {
            console.log(`🔍 컨테이너 ${containerNumber} 처리 시작...`);
            console.log(`📦 파트 개수: ${parts.length}`);
            
            // 컨테이너 넘버가 이미 존재하는지 확인
            const { data: existingContainer, error: checkError } = await this.supabase
                .from('arn_containers')
                .select('arn_number, container_number')
                .eq('container_number', containerNumber)
                .maybeSingle();
            
            if (checkError) {
                console.error('컨테이너 확인 중 오류:', checkError);
                // PGRST116는 데이터가 없는 경우이므로 오류로 처리하지 않음
                if (checkError.code !== 'PGRST116') {
                    throw checkError;
                }
            }
            
            let arnNumber;
            
            if (existingContainer) {
                // 이미 존재하는 컨테이너인 경우 기존 ARN 번호 사용
                arnNumber = existingContainer.arn_number;
                console.log(`✅ 기존 컨테이너 ${containerNumber} 발견! 기존 ARN 번호 사용: ${arnNumber}`);
            } else {
                // 새로운 컨테이너인 경우 새로운 ARN 번호 생성
                arnNumber = await this.generateArnNumber();
                console.log(`🆕 새 컨테이너 ${containerNumber}에 새 ARN 번호 생성: ${arnNumber}`);
                
                const arrivalDate = parts[0].date;
                
                // 컨테이너 데이터 저장
                const { error: containerError } = await this.supabase
                    .from('arn_containers')
                    .insert({
                        arn_number: arnNumber,
                        container_number: containerNumber,
                        arrival_date: arrivalDate,
                        status: 'PENDING'
                    });
                
                if (containerError) {
                    console.error(`❌ 컨테이너 ${containerNumber} 저장 실패:`, containerError);
                    throw containerError;
                }
                
                console.log(`✅ 새 컨테이너 ${containerNumber} 저장 성공! ARN 번호: ${arnNumber}`);
            }
            
            // 파트 데이터 저장 (정리된 파트 번호 사용)
            const partData = parts.map(part => ({
                arn_number: arnNumber,
                container_number: containerNumber,
                part_number: part.part, // 정리된 파트 번호 사용
                quantity: part.quantity,
                status: 'PENDING'
            }));
            
            console.log(`📝 파트 데이터 저장 중... ARN: ${arnNumber}, 컨테이너: ${containerNumber}`);
            console.log(`📋 저장할 파트 데이터:`, partData);
            
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .insert(partData);
            
            if (partsError) {
                console.error(`❌ 파트 데이터 저장 실패:`, partsError);
                throw partsError;
            }
            
            console.log(`✅ 컨테이너 ${containerNumber} 처리 완료! ARN: ${arnNumber}, 파트 ${parts.length}개 저장됨`);
            
        } catch (error) {
            console.error('컨테이너 데이터 저장 오류:', error);
            console.error('오류 상세 정보:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }
    }

    async generateArnNumber() {
        try {
            // 데이터베이스에서 현재 최대 ARN 순번 확인
            const { data: maxArn, error } = await this.supabase
                .from('arn_containers')
                .select('arn_number')
                .order('arn_number', { ascending: false })
                .limit(1);
            
            if (error) {
                console.error('최대 ARN 번호 조회 오류:', error);
                // 오류 발생 시 현재 시간 기반으로 생성
                return this.generateArnNumberByTime();
            }
            
            let nextSequence = 1;
            
            if (maxArn && maxArn.length > 0) {
                const lastArn = maxArn[0].arn_number;
                console.log(`📊 마지막 ARN 번호: ${lastArn}`);
                
                // ARN-YYYYMMDD-XXXXX 형식에서 순번 부분 추출
                const match = lastArn.match(/ARN-\d{8}-(\d+)/);
                if (match) {
                    const lastSequence = parseInt(match[1]);
                    nextSequence = lastSequence + 1;
                    console.log(`📈 다음 순번: ${nextSequence}`);
                }
            }
            
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const sequence = String(nextSequence).padStart(5, '0');
            
            const arnNumber = `ARN-${year}${month}${day}-${sequence}`;
            console.log(`🆔 새 ARN 번호 생성 (순번 기반): ${arnNumber}`);
            return arnNumber;
            
        } catch (error) {
            console.error('ARN 번호 생성 중 오류:', error);
            // 오류 발생 시 현재 시간 기반으로 생성
            return this.generateArnNumberByTime();
        }
    }

    // 기존 시간 기반 ARN 번호 생성 (백업용)
    generateArnNumberByTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time = String(now.getHours()).padStart(2, '0') + 
                    String(now.getMinutes()).padStart(2, '0') + 
                    String(now.getSeconds()).padStart(2, '0');
        
        // 밀리초와 랜덤 숫자를 추가하여 고유성 보장
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        
        const arnNumber = `ARN-${year}${month}${day}-${time}${milliseconds}-${randomNum}`;
        console.log(`🆔 새 ARN 번호 생성 (시간 기반): ${arnNumber}`);
        return arnNumber;
    }

    async updateArnNumberForContainer(containerNumber) {
        const arnNumberField = document.getElementById('arnNumber');
        
        if (!containerNumber || containerNumber.trim() === '') {
            arnNumberField.value = '자동 생성됨';
            return;
        }
        
        try {
            // 컨테이너 넘버가 이미 존재하는지 확인
            const { data: existingContainer, error: checkError } = await this.supabase
                .from('arn_containers')
                .select('arn_number, container_number')
                .eq('container_number', containerNumber.trim())
                .maybeSingle();
            
            if (checkError) {
                console.error('컨테이너 확인 오류:', checkError);
                // PGRST116는 데이터가 없는 경우이므로 오류로 처리하지 않음
                if (checkError.code !== 'PGRST116') {
                    arnNumberField.value = '오류 발생';
                    return;
                }
            }
            
            if (existingContainer) {
                // 기존 컨테이너인 경우 기존 ARN 번호 표시
                arnNumberField.value = existingContainer.arn_number;
                arnNumberField.classList.add('bg-yellow-50', 'text-yellow-800');
                arnNumberField.classList.remove('bg-gray-50', 'text-gray-600');
            } else {
                // 새 컨테이너인 경우 새 ARN 번호 생성
                const newArnNumber = await this.generateArnNumber();
                arnNumberField.value = newArnNumber;
                arnNumberField.classList.remove('bg-yellow-50', 'text-yellow-800');
                arnNumberField.classList.add('bg-gray-50', 'text-gray-600');
            }
        } catch (error) {
            console.error('ARN 번호 업데이트 오류:', error);
            arnNumberField.value = '오류 발생';
        }
    }

    // 수동 등록 관련 메서드들
    showManualRegisterModal() {
        document.getElementById('manualRegisterModal').classList.remove('hidden');
        this.resetManualRegisterForm();
    }

    closeManualRegisterModal() {
        document.getElementById('manualRegisterModal').classList.add('hidden');
        this.resetManualRegisterForm();
    }

    resetManualRegisterForm() {
        document.getElementById('manualRegisterForm').reset();
        document.getElementById('arnNumber').value = '자동 생성됨';
        document.getElementById('partsList').innerHTML = '';
        this.addPartField(); // 기본 파트 필드 하나 추가
    }

    addPartField() {
        const partsList = document.getElementById('partsList');
        const partIndex = partsList.children.length;
        
        const partField = document.createElement('div');
        partField.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg';
        partField.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    파트 번호 <span class="text-red-500">*</span>
                </label>
                <select name="partNumber_${partIndex}" required
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">파트 번호 선택</option>
                    ${this.masterParts.map(part => `
                        <option value="${part.part_number}">${part.part_number}</option>
                    `).join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    수량 <span class="text-red-500">*</span>
                </label>
                <input type="number" name="quantity_${partIndex}" required min="1"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="수량">
            </div>
            <div class="flex items-end">
                <button type="button" onclick="this.parentElement.parentElement.remove()" 
                        class="w-full bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700">
                    <i class="fas fa-trash mr-1"></i>삭제
                </button>
            </div>
        `;
        
        partsList.appendChild(partField);
    }

    async submitManualRegistration() {
        try {
            const formData = new FormData(document.getElementById('manualRegisterForm'));
            const containerNumber = formData.get('containerNumber');
            const arrivalDate = formData.get('arrivalDate');
            
            // 파트 데이터 수집
            const parts = [];
            const partsList = document.getElementById('partsList');
            const partFields = partsList.querySelectorAll('.grid');
            
            partFields.forEach((field, index) => {
                const partNumberSelect = field.querySelector(`select[name="partNumber_${index}"]`);
                const quantity = parseInt(field.querySelector(`input[name="quantity_${index}"]`).value);
                
                // 드롭다운에서 선택된 값 사용
                const partNumber = partNumberSelect.value;
                
                if (partNumber && quantity > 0) {
                    // 파트 번호에서 마지막 알파벳 제거
                    const cleanedPartNumber = this.removeTrailingAlphabet(partNumber);
                    
                    console.log(`파트 ${index + 1}: 원본="${partNumber}" → 정리="${cleanedPartNumber}"`);
                    
                    parts.push({
                        part_number: cleanedPartNumber,
                        quantity: quantity
                    });
                }
            });
            
            if (parts.length === 0) {
                this.showNotification('최소 하나의 파트를 등록해야 합니다.', 'error');
                return;
            }
            
            this.showLoading(true);
            
            // 컨테이너 넘버가 이미 존재하는지 확인
            const { data: existingContainer, error: checkError } = await this.supabase
                .from('arn_containers')
                .select('arn_number, container_number')
                .eq('container_number', containerNumber)
                .maybeSingle();
            
            if (checkError) {
                console.error('컨테이너 확인 중 오류:', checkError);
                // PGRST116는 데이터가 없는 경우이므로 오류로 처리하지 않음
                if (checkError.code !== 'PGRST116') {
                    throw checkError;
                }
            }
            
            let arnNumber;
            
            if (existingContainer) {
                // 이미 존재하는 컨테이너인 경우 기존 ARN 번호 사용
                arnNumber = existingContainer.arn_number;
                console.log(`기존 컨테이너 ${containerNumber}의 ARN 번호 사용: ${arnNumber}`);
            } else {
                // 새로운 컨테이너인 경우 새로운 ARN 번호 생성
                arnNumber = await this.generateArnNumber();
                
                // 컨테이너 데이터 저장
                const { error: containerError } = await this.supabase
                    .from('arn_containers')
                    .insert({
                        arn_number: arnNumber,
                        container_number: containerNumber,
                        arrival_date: this.convertToCentralTime(arrivalDate),
                        status: 'PENDING'
                    });
                
                if (containerError) {
                    throw containerError;
                }
                
                console.log(`새 컨테이너 ${containerNumber}에 ARN 번호 부여: ${arnNumber}`);
            }
            
            // 파트 데이터 저장 (정리된 파트 번호 사용)
            const partData = parts.map(part => ({
                arn_number: arnNumber,
                container_number: containerNumber,
                part_number: part.part_number,
                quantity: part.quantity,
                status: 'PENDING'
            }));
            
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .insert(partData);
            
            if (partsError) {
                throw partsError;
            }
            
            this.showNotification('ARN이 성공적으로 등록되었습니다.', 'success');
            this.closeManualRegisterModal();
            
            // 약간의 지연 후 새로고침 (데이터베이스 반영 시간 확보)
            setTimeout(async () => {
                await this.refreshData();
            }, 500);
            
        } catch (error) {
            console.error('수동 등록 오류:', error);
            this.showNotification('등록 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 컨테이너 편집 관련 메서드들
    editContainer(arnNumber) {
        const container = this.containers.find(c => c.arn_number === arnNumber);
        
        if (!container) {
            this.showNotification('컨테이너를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 입고가 완료된 컨테이너는 수정 불가
        if (container.status === 'COMPLETED') {
            this.showNotification('입고가 완료된 컨테이너는 수정할 수 없습니다.', 'error');
            return;
        }
        
        // 모달에 현재 데이터 설정
        document.getElementById('editArnNumber').value = container.arn_number;
        document.getElementById('editContainerNumber').value = container.container_number;
        document.getElementById('editArrivalDate').value = this.convertToKoreanTime(container.arrival_date);
        
        // 모달 표시
        document.getElementById('containerEditModal').classList.remove('hidden');
    }

    closeContainerEditModal() {
        document.getElementById('containerEditModal').classList.add('hidden');
    }

    async submitContainerEdit() {
        const arnNumber = document.getElementById('editArnNumber').value;
        const containerNumber = document.getElementById('editContainerNumber').value;
        const arrivalDate = document.getElementById('editArrivalDate').value;
        
        if (!containerNumber || !arrivalDate) {
            this.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        const container = this.containers.find(c => c.arn_number === arnNumber);
        
        if (!container) {
            this.showNotification('컨테이너를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 입고가 완료된 컨테이너는 수정 불가
        if (container.status === 'COMPLETED') {
            this.showNotification('입고가 완료된 컨테이너는 수정할 수 없습니다.', 'error');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const { error } = await this.supabase
                .from('arn_containers')
                .update({
                    container_number: containerNumber,
                    arrival_date: this.convertToCentralTime(arrivalDate)
                })
                .eq('arn_number', arnNumber);
            
            if (error) {
                console.error('컨테이너 수정 오류:', error);
                this.showNotification('컨테이너 수정 중 오류가 발생했습니다.', 'error');
                return;
            }
            
            this.showNotification('컨테이너가 성공적으로 수정되었습니다.', 'success');
            this.closeContainerEditModal();
            
            // 약간의 지연 후 새로고침
            setTimeout(async () => {
                await this.refreshData();
            }, 500);
            
        } catch (error) {
            console.error('컨테이너 수정 오류:', error);
            this.showNotification('컨테이너 수정 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    deleteContainer(arnNumber, containerNumber) {
        const container = this.containers.find(c => c.arn_number === arnNumber);
        
        if (!container) {
            this.showNotification('컨테이너를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 입고가 완료된 컨테이너는 삭제 불가
        if (container.status === 'COMPLETED') {
            this.showNotification('입고가 완료된 컨테이너는 삭제할 수 없습니다.', 'error');
            return;
        }
        
        // 삭제 확인 모달에 정보 설정
        document.getElementById('deleteArnNumber').textContent = arnNumber;
        document.getElementById('deleteContainerNumber').textContent = containerNumber;
        
        // 모달 표시
        document.getElementById('containerDeleteModal').classList.remove('hidden');
    }

    closeContainerDeleteModal() {
        document.getElementById('containerDeleteModal').classList.add('hidden');
    }

    async submitContainerDelete() {
        const arnNumber = document.getElementById('deleteArnNumber').textContent;
        const containerNumber = document.getElementById('deleteContainerNumber').textContent;
        
        const container = this.containers.find(c => c.arn_number === arnNumber);
        
        if (!container) {
            this.showNotification('컨테이너를 찾을 수 없습니다.', 'error');
            this.closeContainerDeleteModal();
            return;
        }
        
        // 입고가 완료된 컨테이너는 삭제 불가
        if (container.status === 'COMPLETED') {
            this.showNotification('입고가 완료된 컨테이너는 삭제할 수 없습니다.', 'error');
            this.closeContainerDeleteModal();
            return;
        }
        
        try {
            this.showLoading(true);
            
            // 파트 데이터 먼저 삭제
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .delete()
                .eq('arn_number', arnNumber);
            
            if (partsError) {
                console.error('파트 삭제 오류:', partsError);
                this.showNotification('파트 삭제 중 오류가 발생했습니다.', 'error');
                return;
            }
            
            // 컨테이너 데이터 삭제
            const { error: containerError } = await this.supabase
                .from('arn_containers')
                .delete()
                .eq('arn_number', arnNumber);
            
            if (containerError) {
                console.error('컨테이너 삭제 오류:', containerError);
                this.showNotification('컨테이너 삭제 중 오류가 발생했습니다.', 'error');
                return;
            }
            
            this.showNotification('컨테이너가 성공적으로 삭제되었습니다.', 'success');
            this.closeContainerDeleteModal();
            
            // 약간의 지연 후 새로고침
            setTimeout(async () => {
                await this.refreshData();
            }, 500);
            
        } catch (error) {
            console.error('컨테이너 삭제 오류:', error);
            this.showNotification('컨테이너 삭제 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }





    // 입고 날짜 선택 모달 관련 메서드들
    showInboundDateModal(arnNumber, containerNumber) {
        // 모달에 정보 설정
        document.getElementById('inboundArnNumber').textContent = arnNumber;
        document.getElementById('inboundContainerNumber').textContent = containerNumber;
        
        // 오늘 날짜를 기본값으로 설정
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('inboundDate').value = today;
        
        // 모달 표시
        document.getElementById('inboundDateModal').classList.remove('hidden');
    }

    closeInboundDateModal() {
        const modal = document.getElementById('inboundDateModal');
        modal.classList.add('hidden');
    }

    async submitInboundDate() {
        try {
            const inboundDate = document.getElementById('inboundDate').value;
            
            if (!inboundDate) {
                this.showNotification('입고 날짜를 선택해주세요.', 'error');
                return;
            }
            
            // 컨테이너 입고 처리
            const arnNumber = document.getElementById('inboundArnNumber').textContent;
            const containerNumber = document.getElementById('inboundContainerNumber').textContent;
            
            this.closeInboundDateModal();
            await this.processContainerInbound(arnNumber, containerNumber, inboundDate);
            
        } catch (error) {
            console.error('입고 날짜 제출 오류:', error);
            this.showNotification('입고 처리 중 오류가 발생했습니다.', 'error');
        }
    }

    // 컨테이너 입고 처리 기능
    async processContainerInbound(arnNumber, containerNumber, inboundDate = null) {
        try {
            this.showLoading(true);
            
            // 입고 날짜 설정 (파라미터가 없으면 오늘 날짜 사용)
            const finalInboundDate = inboundDate || new Date().toISOString().split('T')[0];
            
            // 해당 컨테이너의 모든 파트 조회
            const containerParts = this.parts.filter(p => p.arn_number === arnNumber);
            
            // 각 파트별로 inventory 테이블 업데이트
            for (const part of containerParts) {
                // 0. 파트가 parts 테이블에 존재하는지 확인하고 없으면 생성
                const { data: partExists, error: partCheckError } = await this.supabase
                    .from('parts')
                    .select('part_number')
                    .eq('part_number', part.part_number)
                    .maybeSingle();
                
                if (partCheckError && partCheckError.code !== 'PGRST116') {
                    console.error('파트 확인 오류:', partCheckError);
                    continue;
                }
                
                if (!partExists) {
                    // 파트가 존재하지 않으면 자동 생성
                    const category = this.determineCategory(part.part_number);
                    const { error: createPartError } = await this.supabase
                        .from('parts')
                        .insert({
                            part_number: part.part_number,
                            category: category,
                            status: 'ACTIVE'
                        });
                    
                    if (createPartError) {
                        console.error('파트 생성 오류:', createPartError);
                        continue;
                    }
                    
                    console.log(`새 파트 생성됨: ${part.part_number} (${category})`);
                }
                
                // 1. inventory 테이블에서 현재 재고 조회
                const { data: inventoryData, error: inventoryError } = await this.supabase
                    .from('inventory')
                    .select('current_stock, today_inbound')
                    .eq('part_number', part.part_number)
                    .maybeSingle();

                if (inventoryError && inventoryError.code !== 'PGRST116') {
                    continue;
                }

                const currentStock = inventoryData ? inventoryData.current_stock : 0;
                const todayInbound = inventoryData ? inventoryData.today_inbound : 0;
                const newStock = currentStock + part.quantity;
                const newTodayInbound = todayInbound + part.quantity;

                // 2. inventory 테이블 업데이트 또는 생성
                if (inventoryData) {
                    const { error: updateError } = await this.supabase
                        .from('inventory')
                        .update({
                            current_stock: newStock,
                            today_inbound: newTodayInbound,
                            last_updated: new Date().toISOString()
                        })
                        .eq('part_number', part.part_number);

                    if (updateError) {
                        throw updateError;
                    }
                } else {
                    const { error: insertError } = await this.supabase
                        .from('inventory')
                        .insert({
                            part_number: part.part_number,
                            current_stock: newStock,
                            today_inbound: newTodayInbound,
                            last_updated: new Date().toISOString()
                        });

                    if (insertError) {
                        throw insertError;
                    }
                }

                // 3. 거래 내역 기록
                const transactionData = {
                    date: finalInboundDate,
                    part_number: part.part_number,
                    type: 'INBOUND',
                    quantity: part.quantity,
                    balance_after: newStock,
                    reference_number: `ARN_${arnNumber}`,
                    notes: `컨테이너 ${containerNumber} 입고`
                };
                
                console.log('거래 내역 삽입 데이터:', transactionData);
                
                const { error: transactionError } = await this.supabase
                    .from('inventory_transactions')
                    .insert(transactionData);
                
                if (transactionError) {
                    console.error('거래 내역 삽입 오류:', transactionError);
                    console.error('삽입 시도한 데이터:', transactionData);
                    throw transactionError;
                }
            }
            
            // 4. 컨테이너 상태와 입고일을 업데이트
            const { error: containerError } = await this.supabase
                .from('arn_containers')
                .update({
                    status: 'COMPLETED',
                    inbound_date: this.convertToCentralTime(finalInboundDate)
                })
                .eq('arn_number', arnNumber);
            
            if (containerError) {
                throw containerError;
            }
            
            // 5. 해당 컨테이너의 모든 파트를 완료로 업데이트
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .update({
                    status: 'COMPLETED'
                })
                .eq('arn_number', arnNumber);
            
            if (partsError) {
                throw partsError;
            }
            
            const totalQuantity = containerParts.reduce((sum, part) => sum + part.quantity, 0);
            this.showNotification(`컨테이너 ${containerNumber} 입고가 완료되었습니다. (입고일: ${finalInboundDate}, 총 수량: ${totalQuantity})`, 'success');
            
            // 약간의 지연 후 새로고침
            setTimeout(async () => {
                await this.refreshData();
            }, 500);
            
        } catch (error) {
            console.error('컨테이너 입고 처리 오류:', error);
            this.showNotification('컨테이너 입고 처리 중 오류가 발생했습니다.', 'error');
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

    // 현재 시간 업데이트 (UI 표시용)
    updateCurrentTime() {
        try {
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
            
            const currentTimeElement = document.getElementById('currentTime');
            if (currentTimeElement) {
                currentTimeElement.textContent = timeString;
            }
        } catch (error) {
            console.error('시간 업데이트 오류:', error);
        }
    }
}

// 페이지 로드 시 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    window.inboundStatus = new InboundStatus();
}); 