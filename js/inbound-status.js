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
        this.manualParts = []; // 수동 등록 파트 목록
        this.manualTable = null; // 수동 등록 Handsontable
        
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
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                date = new Date(`${parts[2]}-${month}-${day}T00:00:00+09:00`);
            }
            // DD/MM/YYYY 형식인 경우
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDate)) {
                const parts = cleanDate.split('/');
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                date = new Date(`${parts[2]}-${month}-${day}T00:00:00+09:00`);
            }
            else {
                // 기본적으로 현재 날짜 사용
                return new Date().toISOString().split('T')[0];
            }
            
            // 날짜가 유효한지 확인
            if (isNaN(date.getTime())) {
                return new Date().toISOString().split('T')[0];
            }
            
            // 한국 시간을 미국 중부 시간으로 변환 (UTC-6)
            const centralTime = new Date(date.getTime() - (15 * 60 * 60 * 1000)); // 15시간 차이
            return centralTime.toISOString().split('T')[0];
        } catch (error) {
            console.error('날짜 변환 오류:', error);
            return new Date().toISOString().split('T')[0];
        }
    }

    // 미국 중부 시간을 한국 시간으로 변환 (표시용)
    convertToKoreanTime(centralDate) {
        try {
            if (!centralDate) return '-';
            
            // 날짜가 이미 YYYY-MM-DD 형식인지 확인
            if (typeof centralDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(centralDate)) {
                return centralDate; // 이미 날짜만 있으면 그대로 반환
            }
            
            // ISO 형식인 경우 날짜 부분만 추출
            if (typeof centralDate === 'string' && centralDate.includes('T')) {
                return centralDate.split('T')[0];
            }
            
            // Date 객체로 변환 시도
            const date = new Date(centralDate);
            if (isNaN(date.getTime())) {
                console.warn('유효하지 않은 날짜:', centralDate);
                return '-';
            }
            
            return date.toISOString().split('T')[0];
        } catch (error) {
            console.error('날짜 변환 오류:', error, '입력값:', centralDate);
            return '-';
        }
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

    // 파트 번호 정리 함수 (마지막 알파벳 제거)
    cleanPartNumber(partNumber) {
        if (!partNumber || typeof partNumber !== 'string') return partNumber;
        
        let trimmed = partNumber.trim();
        console.log(`원본 파트 번호: "${trimmed}"`);
        
        // $ 기호를 S로 변환 (49580-$9000 → 49580-S9000)
        if (trimmed.includes('$')) {
            trimmed = trimmed.replace(/\$/g, 'S');
            console.log(`$ 기호 변환: ${partNumber} → ${trimmed}`);
        }
        
        // 5자리숫자-영문숫자혼합 패턴에서 마지막 알파벳 제거
        // 49560-S9000K → 49560-S9000
        // 49560-P2600 → 49560-P2600 (변경 없음)
        const pattern = /^(\d{5}-[A-Z0-9]+)([A-Z])$/i;
        const match = trimmed.match(pattern);
        
        if (match) {
            const cleaned = match[1];
            console.log(`파트 번호 정리: ${trimmed} → ${cleaned}`);
            return cleaned;
        }
        
        console.log(`파트 번호 정리 없음: ${trimmed}`);
        return trimmed;
    }

    initializeSupabase() {
        try {
            // CDN으로 로드된 Supabase 사용
            if (typeof supabase !== 'undefined') {
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
                console.log('Supabase 클라이언트 초기화 성공');
            } else {
                console.error('Supabase CDN이 로드되지 않았습니다.');
                // 1초 후 다시 시도
                setTimeout(() => this.initializeSupabase(), 1000);
            }
        } catch (error) {
            console.error('Supabase 초기화 오류:', error);
        }
    }

    async init() {
        try {
            // DOM 요소 캐싱
            this.cacheDOM();
            
            // 이벤트 바인딩
            this.bindEvents();
            
            // 데이터 로드
            await this.loadData();
            
            // UI 초기화
            this.initializeUI();
            
            console.log('InboundStatus 초기화 완료');
        } catch (error) {
            console.error('초기화 오류:', error);
            this.showError('시스템 초기화 중 오류가 발생했습니다.');
        }
    }

    cacheDOM() {
        // 자주 사용되는 DOM 요소들을 캐시
        this.domCache.set('loading', document.getElementById('loading'));
        this.domCache.set('containerTableBody', document.getElementById('containerTableBody'));
        this.domCache.set('partsTableBody', document.getElementById('partsTableBody'));
        this.domCache.set('totalArn', document.getElementById('totalArn'));
        this.domCache.set('completedArn', document.getElementById('completedArn'));
        this.domCache.set('pendingArn', document.getElementById('pendingArn'));
    }

    bindEvents() {
        // 이벤트 위임을 사용하여 동적으로 생성된 요소들도 처리
        document.addEventListener('click', (e) => {
            // CSV 업로드 관련
            if (e.target.closest('#csvUploadBtn')) {
                this.showCsvUploadModal();
            } else if (e.target.closest('#closeCsvUploadModal, #cancelCsvUpload')) {
                this.closeCsvUploadModal();
            } else if (e.target.closest('#selectFileBtn')) {
                document.getElementById('csvFileInput').click();
            } else if (e.target.closest('#removeFileBtn')) {
                this.removeFile();
            } else if (e.target.closest('#processCsvUpload')) {
                this.processCsvUpload();
            }
            
            // 수동 등록 관련
            else if (e.target.closest('#manualRegisterBtn')) {
                this.showManualRegisterModal();
            } else if (e.target.closest('#closeManualRegisterModal, #cancelManualRegister')) {
                this.closeManualRegisterModal();
            } else if (e.target.closest('#saveManualRegister')) {
                this.saveManualRegister();
            }
            
            // 템플릿 다운로드
            else if (e.target.closest('#downloadTemplateBtn')) {
                this.downloadTemplate();
            }
            
            // 컨테이너 관련
            else if (e.target.closest('.delete-container-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const containerId = e.target.closest('.delete-container-btn').dataset.containerId;
                this.deleteContainer(containerId);
            } else if (e.target.closest('.inbound-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const containerId = e.target.closest('.inbound-btn').dataset.containerId;
                this.showInboundDateModal(containerId);
            } else if (e.target.closest('tr[data-container-id]') && !e.target.closest('button')) {
                const containerId = e.target.closest('tr[data-container-id]').dataset.containerId;
                this.showContainerDetails(containerId);
            }
            
            // 모달 관련
            else if (e.target.closest('#cancelContainerDelete, #cancelContainerDeleteBtn')) {
                this.closeContainerDeleteModal();
            } else if (e.target.closest('#cancelInboundDate, #cancelInboundDateBtn')) {
                this.closeInboundDateModal();
            } else if (e.target.closest('#confirmInboundDate')) {
                this.processInbound();
            } else if (e.target.closest('#confirmContainerDelete')) {
                this.confirmDeleteContainer();
            } else if (e.target.closest('#addManualRow')) {
                this.addManualTableRow();
            } else if (e.target.closest('#removeManualSelected')) {
                this.removeManualSelectedRows();
            } else if (e.target.closest('#clearManualTable')) {
                this.clearManualTable();
            }
        });

        // 파일 입력 변경 이벤트
        document.getElementById('csvFileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // 드래그 앤 드롭 이벤트
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
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
                    this.handleFileSelect(files[0]);
            }
        });
    }

        // 필터 이벤트 (디바운싱 적용)
        const filterInputs = ['dateFilter', 'containerFilter', 'statusFilter'];
        filterInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    clearTimeout(this.filterTimeout);
                    this.filterTimeout = setTimeout(() => {
                        this.applyFilters();
                    }, 300);
                });
            }
        });

        // 기타 버튼들
        document.getElementById('applyFilter')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilter')?.addEventListener('click', () => this.resetFilters());
        document.getElementById('refreshData')?.addEventListener('click', () => this.loadData());
    }

    async loadData() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading(true);
        
        try {
            // 컨테이너만 먼저 로드
            await this.loadContainers();
            
            // 마스터 파트는 별도로 로드 (오류가 있어도 계속 진행)
            try {
                await this.loadMasterParts();
            } catch (error) {
                console.error('마스터 파트 로드 실패, 계속 진행:', error);
            }
            
            this.updateStatistics();
            this.renderContainers();
            this.lastDataUpdate = Date.now();
            
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            this.showError('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    async loadContainers() {
        try {
        const { data, error } = await this.supabase
            .from('arn_containers')
            .select('*')
            .order('created_at', { ascending: false });
        
            if (error) throw error;
            
            this.containers = data || [];
            this.filteredContainers = [...this.containers];
            
            // 각 컨테이너의 파트 수량을 로드
            for (let container of this.containers) {
                try {
                    const { data: parts, error: partsError } = await this.supabase
            .from('arn_parts')
                        .select('id, part_number, quantity')
                        .eq('arn_number', container.arn_number);
                    
                    if (partsError) {
                        console.error(`파트 수량 로드 오류 (${container.arn_number}):`, partsError);
                        container.parts_count = 0;
                        container.total_quantity = 0;
                    } else {
                        container.parts_count = parts ? parts.length : 0;
                        container.total_quantity = parts ? parts.reduce((sum, part) => sum + (part.quantity || 0), 0) : 0;
                    }
                } catch (error) {
                    console.error(`파트 수량 로드 예외 (${container.arn_number}):`, error);
                    container.parts_count = 0;
                    container.total_quantity = 0;
                }
            }
            
        } catch (error) {
            console.error('컨테이너 로드 오류:', error);
            throw error;
        }
    }

    async loadMasterParts() {
        try {
        const { data, error } = await this.supabase
            .from('parts')
                .select('*')
            .order('part_number');
        
        if (error) {
                console.error('마스터 파트 로드 오류:', error);
                this.masterParts = [];
                return;
            }
            
            this.masterParts = data || [];
            this.populatePartSelect();
            
        } catch (error) {
            console.error('마스터 파트 로드 예외:', error);
            this.masterParts = [];
        }
    }

    populatePartSelect() {
        const select = document.getElementById('partNumberSelect');
        if (!select) return;
        
        select.innerHTML = `<option value="">${i18n.t('select_part_option')}</option>`;
        this.masterParts.forEach(part => {
            const option = document.createElement('option');
            option.value = part.part_number;
            option.textContent = `${part.part_number} - ${part.category || 'N/A'}`;
            select.appendChild(option);
        });
    }

    updateStatistics() {
        const totalArn = this.containers.length;
        const completedArn = this.containers.filter(c => c.status === 'COMPLETED').length;
        const pendingArn = this.containers.filter(c => c.status === 'PENDING').length;
        
        this.domCache.get('totalArn').textContent = totalArn;
        this.domCache.get('completedArn').textContent = completedArn;
        this.domCache.get('pendingArn').textContent = pendingArn;
    }

    renderContainers() {
        const tbody = this.domCache.get('containerTableBody');
        if (!tbody) return;
        
        if (this.filteredContainers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                        등록된 컨테이너가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredContainers.map(container => {
            const koreanDate = this.convertToKoreanTime(container.arrival_date);
            const partCount = container.parts_count || 0;
            const statusClass = container.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';

            return `
                <tr class="hover:bg-gray-50 cursor-pointer" data-container-id="${container.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${container.arn_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${container.container_number || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${koreanDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                            ${container.status === 'COMPLETED' ? '완료' : '대기'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        ${partCount}개 파트
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        ${container.status !== 'COMPLETED' ? `
                            <button class="delete-container-btn text-red-600 hover:text-red-900 mr-3" data-container-id="${container.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="inbound-btn text-green-600 hover:text-green-900" data-container-id="${container.id}">
                                <i class="fas fa-arrow-down"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }


    // CSV 업로드 관련 메서드들
    showCsvUploadModal() {
        document.getElementById('csvUploadModal').classList.remove('hidden');
        this.resetCsvUpload();
    }

    closeCsvUploadModal() {
        document.getElementById('csvUploadModal').classList.add('hidden');
        this.resetCsvUpload();
    }

    resetCsvUpload() {
        this.selectedFile = null;
        this.fileData = null;
        document.getElementById('csvFileInput').value = '';
        document.getElementById('fileInfo').classList.add('hidden');
        document.getElementById('csvPreview').classList.add('hidden');
        document.getElementById('processCsvUpload').disabled = true;
    }

    handleFileSelect(file) {
        if (!file) return;
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('CSV 파일만 업로드 가능합니다.');
            return;
        }

        this.selectedFile = file;
        this.showFileInfo(file);
        this.parseCsvFile(file);
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.classList.remove('hidden');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    parseCsvFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n').filter(line => line.trim());
                
                if (lines.length < 2) {
                    this.showError('CSV 파일에 데이터가 없습니다.');
                    return;
                }

                // CSV 파싱 개선 - 쉼표가 포함된 값들을 제대로 처리
                const parseCsvLine = (line) => {
                    const result = [];
                    let current = '';
                    let inQuotes = false;
                    
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };

                const headers = parseCsvLine(lines[0]);
                const data = lines.slice(1).map(line => {
                    const values = parseCsvLine(line);
                        const row = {};
                        headers.forEach((header, index) => {
                            // 따옴표 제거 및 공백 제거
                            let value = values[index] || '';
                            if (value.startsWith('"') && value.endsWith('"')) {
                                value = value.slice(1, -1);
                            }
                            row[header] = value.trim();
                        });
                    return row;
                });

                this.fileData = data;
                this.showCsvPreview(data);
                document.getElementById('processCsvUpload').disabled = false;
                
        } catch (error) {
            console.error('CSV 파싱 오류:', error);
                this.showError('CSV 파일을 읽는 중 오류가 발생했습니다.');
            }
        };
        reader.readAsText(file);
    }

    showCsvPreview(data) {
        const preview = document.getElementById('csvPreview');
        const tbody = document.getElementById('csvPreviewBody');
        
        // 컨테이너별로 그룹화하고 같은 파트는 통합 (미리보기용)
        const containerGroups = {};
        data.forEach(row => {
            const containerNumber = row['Container_Number'];
            const cleanedPartNumber = this.cleanPartNumber(row['Part_Number']);
            // 쉼표가 포함된 숫자 처리 (1,120 -> 1120)
            const quantity = parseInt(row['Quantity'].toString().replace(/,/g, '')) || 0;
            
            if (!containerGroups[containerNumber]) {
                containerGroups[containerNumber] = {
                    containerNumber: containerNumber,
                    arrivalDate: row['Arrival_Date'],
                    parts: {}
                };
            }
            
            // 같은 파트가 이미 있으면 수량 합산
            if (containerGroups[containerNumber].parts[cleanedPartNumber]) {
                containerGroups[containerNumber].parts[cleanedPartNumber] += quantity;
            } else {
                containerGroups[containerNumber].parts[cleanedPartNumber] = quantity;
            }
        });
        
        // 통합된 데이터를 배열로 변환
        const consolidatedData = [];
        Object.values(containerGroups).forEach(group => {
            Object.entries(group.parts).forEach(([partNumber, quantity]) => {
                consolidatedData.push({
                    containerNumber: group.containerNumber,
                    partNumber: partNumber,
                    quantity: quantity,
                    arrivalDate: group.arrivalDate
                });
            });
        });
        
        tbody.innerHTML = consolidatedData.slice(0, 10).map(row => `
            <tr>
                <td class="px-4 py-2 text-sm text-gray-800">${row.arrivalDate || ''}</td>
                <td class="px-4 py-2 text-sm text-gray-800">${row.containerNumber || ''}</td>
                <td class="px-4 py-2 text-sm text-gray-800">${row.partNumber || ''}</td>
                <td class="px-4 py-2 text-sm text-gray-800">${row.quantity || ''}</td>
            </tr>
        `).join('');
        
        if (consolidatedData.length > 10) {
            tbody.innerHTML += `
                <tr>
                    <td colspan="4" class="px-4 py-2 text-sm text-gray-500 text-center">
                        ... 및 ${consolidatedData.length - 10}개 행 더
                    </td>
                </tr>
            `;
        }
        
        preview.classList.remove('hidden');
    }

    removeFile() {
        this.resetCsvUpload();
    }

    async processCsvUpload() {
        if (!this.fileData || this.fileData.length === 0) {
            this.showError('처리할 데이터가 없습니다.');
            return;
        }

            this.showLoading(true);
            
        try {
            // 컨테이너별로 그룹화하고 같은 파트는 통합
            const containerGroups = {};
            this.fileData.forEach(row => {
                const containerNumber = row['Container_Number'];
                const cleanedPartNumber = this.cleanPartNumber(row['Part_Number']);
                // 쉼표가 포함된 숫자 처리 (1,120 -> 1120)
                const quantity = parseInt(row['Quantity'].toString().replace(/,/g, '')) || 0;
                
                if (!containerGroups[containerNumber]) {
                    containerGroups[containerNumber] = {
                        containerNumber: containerNumber,
                        arrivalDate: row['Arrival_Date'],
                        parts: {}
                    };
                }
                
                // 같은 파트가 이미 있으면 수량 합산
                if (containerGroups[containerNumber].parts[cleanedPartNumber]) {
                    containerGroups[containerNumber].parts[cleanedPartNumber] += quantity;
                } else {
                    containerGroups[containerNumber].parts[cleanedPartNumber] = quantity;
                }
            });

            // 각 컨테이너별로 처리
            for (const containerNumber in containerGroups) {
                const group = containerGroups[containerNumber];
                
                // ASN 번호 생성
            const arnNumber = await this.generateArnNumber();
                const arrivalDate = this.convertToCentralTime(group.arrivalDate || new Date().toISOString().split('T')[0]);
                
                // 컨테이너 생성
                const { data: container, error: containerError } = await this.supabase
                .from('arn_containers')
                    .insert([{
                    arn_number: arnNumber,
                    container_number: containerNumber,
                    arrival_date: arrivalDate,
                    status: 'PENDING'
                    }])
                    .select()
                    .single();

                if (containerError) throw containerError;

                // 파트 데이터 생성 (통합된 파트들)
                const partsData = Object.entries(group.parts).map(([partNumber, quantity]) => ({
                    arn_number: arnNumber,
                    container_number: containerNumber,
                    part_number: partNumber,
                    quantity: quantity,
                    status: 'PENDING'
                }));

                // 먼저 파트가 parts 테이블에 존재하는지 확인하고 없으면 추가
                for (const partNumber of Object.keys(group.parts)) {
                    try {
                        const { data: existingPart, error: checkError } = await this.supabase
                            .from('parts')
                            .select('part_number')
                            .eq('part_number', partNumber)
                            .single();

                        if (checkError && checkError.code === 'PGRST116') {
                            // 파트가 존재하지 않으면 추가
                            const { error: insertError } = await this.supabase
                                .from('parts')
                                .insert([{
                                    part_number: partNumber,
                                    category: 'UNKNOWN',
                                    description: 'Auto-generated part'
                                }]);
                            
                            if (insertError) {
                                console.warn(`파트 ${partNumber} 추가 실패:`, insertError);
                }
            }
        } catch (error) {
                        console.warn(`파트 ${partNumber} 확인 중 오류:`, error);
                    }
                }
            
                // 파트 삽입
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                    .insert(partsData);
            
                if (partsError) throw partsError;
            }
            
            this.showSuccess(`CSV 업로드가 완료되었습니다. ${Object.keys(containerGroups).length}개 컨테이너가 처리되었습니다.`);
            this.closeCsvUploadModal();
            await this.loadData();
            
        } catch (error) {
            console.error('CSV 업로드 처리 오류:', error);
            this.showError('CSV 업로드 처리 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 수동 등록 관련 메서드들
    async showManualRegisterModal() {
        document.getElementById('manualRegisterModal').classList.remove('hidden');
        
        // ARN 번호 자동 생성
        await this.generateManualArnNumber();
        
        // 기본 정보 초기화
        document.getElementById('manualContainerNumber').value = '';
        document.getElementById('manualArrivalDate').value = new Date().toISOString().split('T')[0];
        
        // masterParts가 로드되지 않았으면 먼저 로드
        if (!this.masterParts || this.masterParts.length === 0) {
            await this.loadMasterParts();
        }
        
        // Handsontable 초기화
        this.initializeManualTable();
    }

    closeManualRegisterModal() {
        document.getElementById('manualRegisterModal').classList.add('hidden');
        if (this.manualTable) {
            this.manualTable.destroy();
            this.manualTable = null;
        }
    }

    initializeManualTable() {
        const container = document.getElementById('manualTableContainer');
        if (!container) return;

        // 기존 테이블이 있으면 제거
        if (this.manualTable) {
            this.manualTable.destroy();
        }

        // 컨테이너 초기화
        container.innerHTML = '';

        // masterParts가 로드되지 않았으면 빈 배열 사용
        const partNumbers = this.masterParts && this.masterParts.length > 0 
            ? this.masterParts.map(part => part.part_number)
            : [];

        this.manualTable = new Handsontable(container, {
            data: Array(10).fill().map(() => ['', '']), // 10개 행으로 시작 (파트번호, 수량)
            columns: [
                {
                    data: 0, // 첫 번째 컬럼
                    title: '파트 번호',
                    type: partNumbers.length > 0 ? 'dropdown' : 'text',
                    source: partNumbers,
                    width: 250,
                    validator: (value, callback) => {
                        if (!value) {
                            callback(true); // 빈 값은 허용
                            return;
                        }
                        // 파트 번호 형식 검증 (5자리 숫자-5자리 영숫자)
                        const pattern = /^\d{5}-[A-Z0-9]{5}$/;
                        if (pattern.test(value)) {
                            callback(true);
                        } else {
                            callback(false);
                        }
                    }
                },
                {
                    data: 1, // 두 번째 컬럼
                    title: '수량',
                    type: 'numeric',
                    width: 120,
                    validator: (value, callback) => {
                        if (!value) {
                            callback(true); // 빈 값은 허용
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
            colHeaders: true,
            rowHeaders: true,
            contextMenu: true,
            manualColumnResize: true,
            manualRowResize: true,
            stretchH: 'all',
            height: 300,
            afterChange: (changes, source) => {
                if (source === 'edit') {
                    // 파트 번호 변경 시 자동으로 마지막 알파벳 제거
                    changes.forEach(([row, prop, oldValue, newValue]) => {
                        if (prop === 0 && newValue) { // 파트 번호 컬럼
                            const cleaned = this.cleanPartNumber(newValue);
                            if (cleaned !== newValue) {
                                this.manualTable.setDataAtCell(row, prop, cleaned);
                            }
                        }
                    });
                }
            },
            licenseKey: 'non-commercial-and-evaluation'
        });
    }

    addManualTableRow() {
        if (!this.manualTable) return;
        const data = this.manualTable.getData();
        data.push(['', '']); // 빈 행 추가 (파트번호, 수량)
        this.manualTable.loadData(data);
    }

    removeManualSelectedRows() {
        if (!this.manualTable) return;
        const selected = this.manualTable.getSelected();
        if (selected && selected.length > 0) {
            const data = this.manualTable.getData();
            // 선택된 행들을 역순으로 삭제 (인덱스가 변경되지 않도록)
            const rowsToDelete = [...new Set(selected.map(sel => sel[0][0]))].sort((a, b) => b - a);
            rowsToDelete.forEach(rowIndex => {
                data.splice(rowIndex, 1);
            });
            this.manualTable.loadData(data);
        }
    }

    clearManualTable() {
        if (!this.manualTable) return;
        this.manualTable.loadData(Array(10).fill().map(() => ['', ''])); // 10개 빈 행으로 초기화
    }

    resetManualRegister() {
        this.manualParts = [];
        document.getElementById('manualContainerNumber').value = '';
        document.getElementById('manualArrivalDate').value = new Date().toISOString().split('T')[0];
        
        // Handsontable 초기화
        if (this.manualTable) {
            this.manualTable.loadData(Array(10).fill().map(() => ['', ''])); // 10개 빈 행으로 초기화
        }
    }

    async generateManualArnNumber() {
        try {
            const arnNumber = await this.generateArnNumber();
            document.getElementById('manualArnNumber').value = arnNumber;
        } catch (error) {
            console.error('ARN 번호 생성 오류:', error);
        }
    }

    async generateArnNumber() {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const { data, error } = await this.supabase
                .from('arn_containers')
                .select('arn_number')
            .like('arn_number', `ASN${today}%`)
                .order('arn_number', { ascending: false })
                .limit(1);
            
        if (error) throw error;

        let sequence = 1;
        if (data && data.length > 0) {
            const lastArn = data[0].arn_number;
            const lastSequence = parseInt(lastArn.slice(-3));
            sequence = lastSequence + 1;
        }

        return `ASN${today}${sequence.toString().padStart(3, '0')}`;
    }

    async showContainerDetails(containerId) {
        const container = this.containers.find(c => c.id == containerId);
        if (!container) {
            console.error('컨테이너를 찾을 수 없습니다:', containerId);
            return;
        }
        
        // 파트 정보 로드
        try {
            const { data: parts, error } = await this.supabase
                .from('arn_parts')
                .select('*')
                .eq('arn_number', container.arn_number);
            
            if (error) {
                console.error('파트 로드 오류:', error);
                this.showError('파트 정보를 불러올 수 없습니다.');
                    return;
            }

            // 파트 상세 정보를 테이블에 표시
            this.renderPartsInTable(container, parts || []);
        } catch (error) {
            console.error('파트 로드 예외:', error);
            this.showError('파트 정보를 불러올 수 없습니다.');
        }
    }

    renderPartsInTable(container, parts) {
        const tbody = document.getElementById('partsTableBody');
        if (!tbody) return;

        if (parts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-800/60">
                        이 컨테이너에는 등록된 파트가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = parts.map(part => {
            const statusClass = part.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${container.arn_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${part.container_number || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${part.part_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${part.quantity || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${this.formatDateOnly(container.inbound_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                            ${part.status === 'COMPLETED' ? '완료' : '대기'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async saveManualRegister() {
        const containerNumber = document.getElementById('manualContainerNumber').value.trim();
        const arrivalDate = document.getElementById('manualArrivalDate').value;

        if (!containerNumber) {
            this.showError('컨테이너 번호를 입력해주세요.');
            return;
        }

        if (!arrivalDate) {
            this.showError('도착 예정일을 선택해주세요.');
            return;
        }
            
        // Handsontable에서 데이터 가져오기
        const tableData = this.manualTable ? this.manualTable.getData() : [];
        const validParts = tableData.filter(row => row[0] && row[1] && row[1] > 0);
        
        if (validParts.length === 0) {
            this.showError('최소 하나의 파트를 추가해주세요.');
                return;
            }
            
            this.showLoading(true);
            
        try {
            // ARN 번호 자동 생성
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const arnNumber = `ASN${today}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
            
            // ARN 번호 필드에 표시
            document.getElementById('manualArnNumber').value = arnNumber;
            
            const centralDate = this.convertToCentralTime(arrivalDate);

            // 컨테이너 생성
            const { data: container, error: containerError } = await this.supabase
                .from('arn_containers')
                .insert([{
                    arn_number: arnNumber,
                    container_number: containerNumber,
                    arrival_date: centralDate,
                    status: 'PENDING'
                }])
                .select()
                .single();

            if (containerError) throw containerError;

            // 먼저 파트가 parts 테이블에 존재하는지 확인하고 없으면 추가
            for (const part of validParts) {
                const partNumber = this.cleanPartNumber(part[0]); // 파트 번호 정리
                try {
                    const { data: existingPart, error: checkError } = await this.supabase
                        .from('parts')
                        .select('part_number')
                        .eq('part_number', partNumber)
                        .single();

                    if (checkError && checkError.code === 'PGRST116') {
                        // 파트가 존재하지 않으면 추가
                        const category = this.getCategoryFromPartNumber(partNumber);
                        const { error: insertError } = await this.supabase
                            .from('parts')
                            .insert([{
                                part_number: partNumber,
                                category: category,
                                description: 'Auto-generated part',
                                status: 'ACTIVE'
                            }]);
                        
                        if (insertError) {
                            console.warn(`파트 ${partNumber} 추가 실패:`, insertError);
                        }
                    }
                } catch (error) {
                    console.warn(`파트 ${partNumber} 확인 중 오류:`, error);
                }
            }

            // 파트 데이터 생성 (정리된 파트 번호 사용)
            const partsData = validParts.map(part => ({
                arn_number: arnNumber,
                container_number: containerNumber,
                part_number: this.cleanPartNumber(part[0]),
                quantity: parseInt(part[1]),
                status: 'PENDING'
            }));
            
            // 파트 삽입
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .insert(partsData);
            
            if (partsError) throw partsError;
            
            this.showSuccess('수동 등록이 완료되었습니다.');
            this.closeManualRegisterModal();
            await this.loadData();
            
        } catch (error) {
            console.error('수동 등록 오류:', error);
            this.showError('수동 등록 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 템플릿 다운로드
    downloadTemplate() {
        const headers = ['Arrival_Date', 'Container_Number', 'Part_Number', 'Quantity'];
        const sampleData = [
            ['2024-01-15', 'CONT-001', '49560-L3010', '10'],
            ['2024-01-15', 'CONT-001', '49560-S9000', '5']
        ];

        let csvContent = headers.join(',') + '\n';
        csvContent += sampleData.map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'inbound_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // 컨테이너 관련 메서드들

    deleteContainer(containerId) {
        const container = this.containers.find(c => c.id == containerId);
        if (!container) {
            console.error('컨테이너를 찾을 수 없습니다:', containerId);
            return;
        }
        
        console.log('컨테이너 삭제:', container);
        this.selectedContainer = container; // 선택된 컨테이너 저장
        
        document.getElementById('deleteArnNumber').textContent = container.arn_number;
        document.getElementById('deleteContainerNumber').textContent = container.container_number;

        document.getElementById('containerDeleteModal').classList.remove('hidden');
    }

    showInboundDateModal(containerId) {
        const container = this.containers.find(c => c.id == containerId);
        if (!container) {
            console.error('컨테이너를 찾을 수 없습니다:', containerId);
            return;
        }
        
        console.log('입고 모달:', container);
        this.selectedContainer = container; // 선택된 컨테이너 저장

        document.getElementById('inboundArnNumber').textContent = container.arn_number;
        document.getElementById('inboundContainerNumber').textContent = container.container_number;
        document.getElementById('inboundDate').value = new Date().toISOString().split('T')[0];

        document.getElementById('inboundDateModal').classList.remove('hidden');
    }

    closeContainerDeleteModal() {
        document.getElementById('containerDeleteModal').classList.add('hidden');
    }

    async confirmDeleteContainer() {
        const containerId = this.selectedContainer?.id;
        if (!containerId) {
            this.showError('삭제할 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
            this.showLoading(true);
            
        try {
            // 먼저 관련된 파트들을 삭제
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .delete()
                .eq('arn_number', this.selectedContainer.arn_number);
            
            if (partsError) {
                console.error('파트 삭제 오류:', partsError);
                throw partsError;
            }
            
            // 컨테이너 삭제
            const { error: containerError } = await this.supabase
                .from('arn_containers')
                .delete()
                .eq('id', containerId);
            
            if (containerError) {
                console.error('컨테이너 삭제 오류:', containerError);
                throw containerError;
            }
            
            this.showSuccess('컨테이너가 성공적으로 삭제되었습니다.');
            this.closeContainerDeleteModal();
            await this.loadData();
            
        } catch (error) {
            console.error('컨테이너 삭제 처리 오류:', error);
            this.showError('컨테이너 삭제 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    closeInboundDateModal() {
        document.getElementById('inboundDateModal').classList.add('hidden');
    }

    async processInbound() {
        const containerId = this.selectedContainer?.id;
        const inboundDate = document.getElementById('inboundDate').value;
        
        if (!containerId || !inboundDate) {
            this.showError('입고 처리할 컨테이너와 날짜를 확인해주세요.');
            return;
        }
            
        this.showLoading(true);

        try {
            const centralDate = this.convertToCentralTime(inboundDate);

            // 1. 컨테이너 상태 업데이트 (입고일 포함)
            const { error: containerError } = await this.supabase
                .from('arn_containers')
                .update({
                    status: 'COMPLETED',
                    inbound_date: centralDate
                })
                .eq('id', containerId);
            
            if (containerError) throw containerError;
            
            // 2. 파트 상태 업데이트
            const { error: partsError } = await this.supabase
                .from('arn_parts')
                .update({
                    status: 'COMPLETED'
                })
                .eq('arn_number', this.selectedContainer.arn_number);

            if (partsError) throw partsError;

            // 3. 입고된 파트들을 inventory에 반영
            await this.updateInventoryFromInbound(containerId, centralDate);

            this.showSuccess('입고 처리가 완료되었습니다.');
            this.closeInboundDateModal();
            await this.loadData();
            
        } catch (error) {
            console.error('입고 처리 오류:', error);
            this.showError('입고 처리 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 입고된 파트들을 inventory에 반영하는 함수
    async updateInventoryFromInbound(containerId, inboundDate) {
        try {
            console.log('재고 업데이트 시작:', containerId);
            
            // 입고된 파트들 조회
            const { data: inboundParts, error: partsError } = await this.supabase
                .from('arn_parts')
                .select('part_number, quantity')
                .eq('arn_number', this.selectedContainer.arn_number)
                .eq('status', 'COMPLETED');

            if (partsError) throw partsError;

            console.log('입고된 파트들:', inboundParts);

            // 각 파트에 대해 재고 업데이트
            for (const part of inboundParts) {
                await this.updatePartInventory(part.part_number, part.quantity, inboundDate, this.selectedContainer.arn_number);
            }

            console.log('재고 업데이트 완료');
        } catch (error) {
            console.error('재고 업데이트 오류:', error);
            throw error;
        }
    }

    // 개별 파트의 재고를 업데이트하는 함수
    async updatePartInventory(partNumber, quantity, inboundDate, arnNumber) {
        try {
            console.log(`파트 ${partNumber} 재고 업데이트: +${quantity}`);

            // 1. inventory 테이블에서 해당 파트 조회
            const { data: existingInventory, error: inventoryError } = await this.supabase
                    .from('inventory')
                .select('part_number, current_stock, status, last_updated')
                .eq('part_number', partNumber)
                    .maybeSingle();

            if (inventoryError) {
                console.warn(`파트 ${partNumber} 재고 조회 오류:`, inventoryError);
                // 조회 오류가 있어도 새로 생성하도록 진행
            }

            if (existingInventory && existingInventory.part_number) {
                // 기존 재고가 있으면 수량 증가
                const newStock = (existingInventory.current_stock || 0) + quantity;
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
                console.log(`파트 ${partNumber} 재고 증가: ${existingInventory.current_stock} → ${newStock}`);
                } else {
                // 기존 재고가 없으면 새로 생성
                    const { error: insertError } = await this.supabase
                        .from('inventory')
                        .insert({
                        part_number: partNumber,
                        current_stock: quantity,
                        status: 'in_stock',
                            last_updated: new Date().toISOString()
                        });

                    if (insertError) {
                    console.error(`파트 ${partNumber} 재고 생성 실패:`, insertError);
                        throw insertError;
                    }
                console.log(`파트 ${partNumber} 새 재고 생성: ${quantity}`);
            }

            // 2. inventory_transactions에 거래 내역 기록
            const transactionDate = inboundDate.includes('T') ? inboundDate.split('T')[0] : inboundDate;
                const { error: transactionError } = await this.supabase
                    .from('inventory_transactions')
                .insert({
                    transaction_date: transactionDate,
                    part_number: partNumber,
                    transaction_type: 'INBOUND',
                    quantity: quantity,
                    reference_id: arnNumber,
                    notes: `입고 처리 - ARN: ${arnNumber}`
                });
                
                if (transactionError) {
                console.error(`파트 ${partNumber} 거래 내역 기록 실패:`, transactionError);
                // 거래 내역 기록 실패해도 재고 업데이트는 성공으로 처리
            } else {
                console.log(`파트 ${partNumber} 거래 내역 기록 완료`);
            }

        } catch (error) {
            console.error(`파트 ${partNumber} 재고 업데이트 실패:`, error);
            throw error;
        }
    }

    // 필터 관련 메서드들
    applyFilters() {
        const dateFilter = document.getElementById('dateFilter').value;
        const containerFilter = document.getElementById('containerFilter').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredContainers = this.containers.filter(container => {
            const matchesDate = !dateFilter || this.convertToKoreanTime(container.arrival_date) === dateFilter;
            const matchesContainer = !containerFilter || container.container_number.toLowerCase().includes(containerFilter);
            const matchesStatus = !statusFilter || container.status === statusFilter;

            return matchesDate && matchesContainer && matchesStatus;
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

    // UI 관련 메서드들
    initializeUI() {
        // 현재 날짜를 기본값으로 설정
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('manualArrivalDate').value = today;
        document.getElementById('inboundDate').value = today;
    }

    showLoading(show) {
        const loading = this.domCache.get('loading');
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    }

    showError(message) {
        alert(i18n.t('error_prefix') + message);
    }

    showSuccess(message) {
        alert(i18n.t('success_prefix') + message);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new InboundStatus();
}); 
