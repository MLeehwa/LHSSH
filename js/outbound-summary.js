// Outbound Summary JavaScript - Performance Optimized
class OutboundSummary {
    constructor() {
        this.outboundData = [];
        this.filteredData = [];
        this.currentView = 'monthly';
        this.selectedMonth = new Date().toISOString().slice(0, 7);
        this.supabase = null;
        this.filterTimeout = null;
        
        // Performance optimizations
        this.cache = new Map();
        this.lastDataUpdate = 0;
        this.dataUpdateInterval = 30000; // 30 seconds
        this.isLoading = false;
        this.domCache = new Map();
        
        console.log('OutboundSummary 클래스 생성됨');
    }

    async initializeSupabase() {
        try {
            console.log('Supabase 클라이언트 초기화 시작...');
            
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
                console.log('전역 Supabase 클라이언트 사용');
            } else {
                if (typeof supabase === 'undefined') {
                    console.error('Supabase 라이브러리가 로드되지 않았습니다.');
                    throw new Error('Supabase 라이브러리가 로드되지 않았습니다.');
                }
                
                const config = window.getCurrentConfig ? window.getCurrentConfig() : {
                    url: window.SUPABASE_URL || 'https://vzemucykhxlxgjuldibf.supabase.co',
                    anonKey: window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ'
                };
                
                this.supabase = supabase.createClient(config.url, config.anonKey, {
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
                });
                console.log('config.js 설정으로 새 Supabase 클라이언트 생성');
            }
            
            const isConnected = await this.testConnection();
            if (!isConnected) {
                console.warn('Supabase 연결 실패 - Mock 데이터 모드로 전환');
                this.supabase = null;
            } else {
                console.log('Supabase 클라이언트 초기화 성공');
            }
        } catch (error) {
            console.error('Supabase 클라이언트 초기화 실패:', error);
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

    async init() {
        try {
            console.log('OutboundSummary 초기화 시작...');
            await this.initializeSupabase();
            await this.loadData();
            this.bindEvents();
            this.initializeDropdowns();
            this.updateDropdownVisibility();
            this.updateStats();
            this.updateCurrentTime();
            
            // Performance: Use requestAnimationFrame for time updates
            this.scheduleTimeUpdate();
            
            console.log('OutboundSummary 초기화 완료');
        } catch (error) {
            console.error('OutboundSummary 초기화 오류:', error);
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
        const container = document.getElementById('outboundSummaryContainer') || document.body;
        
        // Single event listener for all interactions
        container.addEventListener('click', (e) => {
            // View mode buttons
            if (e.target.matches('#monthlyViewBtn')) {
                this.switchToMonthlyView();
            } else if (e.target.matches('#weeklyViewBtn')) {
                this.switchToWeeklyView();
            } else if (e.target.matches('#refreshDataBtn')) {
                this.refreshData();
            } else if (e.target.matches('#exportBtn')) {
                this.exportData('excel');
            }
        });

        // Dropdown change events
        container.addEventListener('change', (e) => {
            if (e.target.matches('#yearDropdown, #monthDropdown')) {
                this.handleMonthChange();
            } else if (e.target.matches('#weekDropdown')) {
                this.handleWeekChange();
            }
        });

        // Input events
        container.addEventListener('input', (e) => {
            if (e.target.matches('#partNumberFilter')) {
                this.debouncedApplyFilters();
            }
        });
    }

    switchToMonthlyView() {
        this.currentView = 'monthly';
        document.getElementById('monthlyViewBtn').classList.add('bg-blue-600', 'text-white');
        document.getElementById('weeklyViewBtn').classList.remove('bg-blue-600', 'text-white');
        this.updateDropdownVisibility();
        this.applyFilters();
    }

    switchToWeeklyView() {
        this.currentView = 'weekly';
        document.getElementById('weeklyViewBtn').classList.add('bg-blue-600', 'text-white');
        document.getElementById('monthlyViewBtn').classList.remove('bg-blue-600', 'text-white');
        this.updateDropdownVisibility();
        this.applyFilters();
    }

    handleMonthChange() {
        const year = document.getElementById('yearDropdown').value;
        const month = document.getElementById('monthDropdown').value;
        this.selectedMonth = `${year}-${month}`;
        this.applyFilters();
    }

    handleWeekChange() {
        this.applyFilters();
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
            const [sequencesResult, partsResult] = await Promise.all([
                this.loadOutboundSequences(),
                this.loadOutboundParts()
            ]);
            
            this.outboundData = this.combineOutboundData(sequencesResult, partsResult);
            this.filteredData = [...this.outboundData];
            
            this.lastDataUpdate = now;
            this.cache.clear();
            
            console.log('데이터 로드 완료. 총 데이터:', this.outboundData.length);
            
            this.renderTable();
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
            .order('date', { ascending: false });
        
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
            .order('sequence_id', { ascending: false });
        
        if (error) {
            console.error('출고 파트 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    loadMockData() {
        this.outboundData = this.getMockOutboundData();
        this.filteredData = [...this.outboundData];
        this.renderTable();
        this.updateStats();
    }

    // 시퀀스와 파트 데이터를 조합하여 출하 요약 데이터 생성
    combineOutboundData(sequences, parts) {
        const combinedData = [];
        
        if (!sequences || !parts) {
            console.warn('시퀀스 또는 파트 데이터가 없습니다.');
            return combinedData;
        }
        
        for (const sequence of sequences) {
            if (!sequence || !sequence.id) continue;
            
            const sequenceParts = parts.filter(part => part && part.sequence_id === sequence.id);
            
            for (const part of sequenceParts) {
                if (!part || !part.part_number) continue;
                
                const scannedQty = part.scanned_qty || 0;
                const actualQty = part.actual_qty || 0;
                
                combinedData.push({
                    date: sequence.date || new Date().toISOString().split('T')[0],
                    sequence: sequence.seq || 'Unknown', // seq 필드 사용
                    partNumber: part.part_number,
                    scannedQty: scannedQty,
                    actualQty: actualQty,
                    difference: scannedQty - actualQty,
                    status: sequence.status || 'PENDING',
                    sequenceId: sequence.id
                });
            }
        }
        
        console.log('조합된 출하 데이터:', combinedData.length, '개 항목');
        return combinedData;
    }



    getMockOutboundData() {
        return [
            { date: '2024-01-01', sequence: 1, partNumber: '49560-12345', scannedQty: 50, actualQty: 48, difference: 2, status: 'CONFIRMED', sequenceId: 1 },
            { date: '2024-01-01', sequence: 2, partNumber: '49560-12345', scannedQty: 45, actualQty: 43, difference: 2, status: 'CONFIRMED', sequenceId: 2 },
            { date: '2024-01-01', sequence: 'AS', partNumber: '49560-12345', scannedQty: 5, actualQty: 5, difference: 0, status: 'CONFIRMED', sequenceId: 3 },
            { date: '2024-01-01', sequence: 1, partNumber: '49600-67890', scannedQty: 30, actualQty: 28, difference: 2, status: 'CONFIRMED', sequenceId: 4 },
            { date: '2024-01-02', sequence: 1, partNumber: '49560-12345', scannedQty: 55, actualQty: 52, difference: 3, status: 'CONFIRMED', sequenceId: 5 },
            { date: '2024-01-02', sequence: 2, partNumber: '49560-12345', scannedQty: 50, actualQty: 48, difference: 2, status: 'CONFIRMED', sequenceId: 6 },
            { date: '2024-01-02', sequence: 3, partNumber: '49560-12345', scannedQty: 45, actualQty: 43, difference: 2, status: 'CONFIRMED', sequenceId: 7 },
            { date: '2024-01-02', sequence: 'AS', partNumber: '49600-67890', scannedQty: 8, actualQty: 8, difference: 0, status: 'CONFIRMED', sequenceId: 8 }
        ];
    }

    applyFilters() {
        console.log('필터 적용 시작...');
        
        try {
            const yearEl = document.getElementById('yearFilter');
            const monthEl = document.getElementById('monthFilter');
            const weekEl = document.getElementById('weekFilter');
            const partNumberEl = document.getElementById('partNumberFilter');
            const statusEl = document.getElementById('statusFilter');
            
            if (!yearEl && !monthEl && !weekEl) {
                console.error('필터 요소를 찾을 수 없습니다.');
                return;
            }

            // 필터 값들 가져오기
            const partNumberFilter = partNumberEl ? partNumberEl.value.toLowerCase() : '';
            const statusFilter = statusEl ? statusEl.value : '';
            
            let filteredData = [...this.outboundData];
            
            // 현재 보기 모드에 따른 필터링
            if (this.currentView === 'monthly') {
                // 월별 보기: 년도와 월로 필터링
                const selectedYear = yearEl ? parseInt(yearEl.value) : new Date().getFullYear();
                const selectedMonth = monthEl ? parseInt(monthEl.value) : new Date().getMonth() + 1;
                
                console.log(`월별 필터링: ${selectedYear}년 ${selectedMonth}월`);
                
                filteredData = filteredData.filter(item => {
                    const itemDate = new Date(item.date);
                    const itemYear = itemDate.getFullYear();
                    const itemMonth = itemDate.getMonth() + 1;
                    
                    return itemYear === selectedYear && itemMonth === selectedMonth;
                });
            } else {
                // 주별 보기: week 필터 사용
                const selectedWeek = weekEl ? weekEl.value : '';
                console.log(`주별 필터링: ${selectedWeek}`);
                
                if (selectedWeek) {
                    filteredData = filteredData.filter(item => {
                        const itemDate = new Date(item.date);
                        const itemWeek = this.getWeekNumber(itemDate);
                        const itemYear = itemDate.getFullYear();
                        return `${itemYear}-W${itemWeek.toString().padStart(2, '0')}` === selectedWeek;
                    });
                }
            }
            
            // 파트 번호 필터
            if (partNumberFilter) {
                filteredData = filteredData.filter(item => 
                    item.partNumber && item.partNumber.toLowerCase().includes(partNumberFilter)
                );
            }
            
            // 상태 필터 (CONFIRMED만 표시)
            filteredData = filteredData.filter(item => item.status === 'CONFIRMED');
            
            this.filteredData = filteredData;
            console.log(`필터링 완료: ${filteredData.length}개 항목`);
            
            this.renderTable();
            this.updateStats();
            
        } catch (error) {
            console.error('필터 적용 중 오류:', error);
            this.showNotification('필터 적용 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }



    // 이번 주 확인
    isInCurrentWeek(date) {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        return date >= startOfWeek && date <= endOfWeek;
    }

    // 지난 주 확인
    isInLastWeek(date) {
        const today = new Date();
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        startOfLastWeek.setHours(0, 0, 0, 0);
        
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        endOfLastWeek.setHours(23, 59, 59, 999);
        
        return date >= startOfLastWeek && date <= endOfLastWeek;
    }

    // 주차 계산 헬퍼
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }



    resetFilters() {
        console.log('필터 초기화...');
        
        try {
            const yearEl = document.getElementById('yearFilter');
            const monthEl = document.getElementById('monthFilter');
            const weekEl = document.getElementById('weekFilter');
            const partNumberEl = document.getElementById('partNumberFilter');
            const statusEl = document.getElementById('statusFilter');
            
            // 현재 날짜로 기본값 설정
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;
            
            // 보기 모드에 따른 기본값 설정
            if (this.currentView === 'monthly') {
                // 월별 보기: 현재 년도와 월로 설정
                if (yearEl) yearEl.value = currentYear;
                if (monthEl) monthEl.value = currentMonth;
            } else {
                // 주별 보기: 현재 주로 설정
                const currentWeek = this.getWeekNumber(currentDate);
                const currentYear = currentDate.getFullYear();
                const weekValue = `${currentYear}-W${currentWeek.toString().padStart(2, '0')}`;
                if (weekEl) weekEl.value = weekValue;
            }
            
            // 파트 번호와 상태 필터 초기화
            if (partNumberEl) partNumberEl.value = '';
            if (statusEl) statusEl.value = '';
            
            console.log('필터 초기화 완료');
            this.applyFilters();
            
        } catch (error) {
            console.error('필터 초기화 중 오류:', error);
            this.showNotification('필터 초기화 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }

    renderTable() {
        try {
            const tbody = document.getElementById('summaryTableBody');
            
            if (!tbody) {
                console.error('summaryTableBody element not found');
                return;
            }
            
            if (!this.filteredData || this.filteredData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                            <div class="flex flex-col items-center">
                                <i class="fas fa-inbox text-4xl mb-4 text-gray-300"></i>
                                <p class="text-lg font-medium">조건에 맞는 출하 데이터가 없습니다.</p>
                                <p class="text-sm text-gray-400 mt-1">필터 조건을 변경해보세요.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            // 확정된 데이터만 필터링
            const confirmedData = this.filteredData.filter(item => item.status === 'CONFIRMED');
            
            if (confirmedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                            <div class="flex flex-col items-center">
                                <i class="fas fa-check-circle text-4xl mb-4 text-gray-300"></i>
                                <p class="text-lg font-medium">확정된 출하 데이터가 없습니다.</p>
                                <p class="text-sm text-gray-400 mt-1">확정된 데이터만 표시됩니다.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            // 가로 요약 테이블 구조 생성
            const summaryStructure = this.createHorizontalSummaryStructure(confirmedData);
            
            if (!summaryStructure || summaryStructure.dates.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                            <div class="flex flex-col items-center">
                                <i class="fas fa-exclamation-triangle text-4xl mb-4 text-gray-300"></i>
                                <p class="text-lg font-medium">데이터를 처리할 수 없습니다.</p>
                                <p class="text-sm text-gray-400 mt-1">페이지를 새로고침해보세요.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            
            // 1. 날짜 헤더 행
            html += `
                <tr class="bg-gradient-to-r from-blue-600 to-blue-700 border-b-2 border-blue-800">
                    <td class="px-6 py-3 text-sm font-bold text-white border-r border-blue-800" style="min-width: 150px;">
                        파트 번호
                    </td>
            `;
            
            summaryStructure.dates.forEach(date => {
                const dateObj = new Date(date);
                const formattedDate = dateObj.toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short'
                });
                
                const sequences = summaryStructure.dateSequences[date] || [];
                const colSpan = sequences.length > 0 ? sequences.length : 1;
                
                html += `
                    <td colspan="${colSpan}" class="px-6 py-3 text-center text-sm font-bold text-white border-r border-blue-800">
                        ${formattedDate}
                    </td>
                `;
            });
            
            html += '</tr>';
            
            // 2. 차수 헤더 행
            html += `
                <tr class="bg-blue-100 border-b border-blue-300">
                    <td class="px-6 py-2 text-sm font-medium text-blue-900 border-r border-blue-300">
                        차수
                    </td>
            `;
            
            summaryStructure.dates.forEach(date => {
                const sequences = summaryStructure.dateSequences[date] || [];
                
                if (sequences.length === 0) {
                    html += `
                        <td class="px-6 py-2 text-center text-xs text-blue-700 border-r border-blue-300">
                            -
                        </td>
                    `;
                } else {
                    sequences.forEach((sequence, index) => {
                        const isLast = index === sequences.length - 1;
                        const sequenceName = sequence === 'AS' ? 'AS' : `${sequence}차`;
                        
                        html += `
                            <td class="px-6 py-2 text-center text-xs font-medium text-blue-800 border-r ${isLast ? 'border-blue-300' : 'border-blue-200'}">
                                ${sequenceName}
                            </td>
                        `;
                    });
                }
            });
            
            html += '</tr>';
            
            // 3. 파트별 데이터 행
            summaryStructure.parts.forEach((partNumber, rowIndex) => {
                const isEvenRow = rowIndex % 2 === 0;
                html += `
                    <tr class="hover:bg-blue-50 transition-colors duration-150 border-b border-gray-200 ${isEvenRow ? 'bg-gray-50' : 'bg-white'}">
                        <td class="px-6 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">
                            ${partNumber}
                        </td>
                `;
                
                summaryStructure.dates.forEach(date => {
                    const sequences = summaryStructure.dateSequences[date] || [];
                    
                    if (sequences.length === 0) {
                        html += `
                            <td class="px-6 py-3 text-center text-sm text-gray-400 border-r border-gray-300">
                                -
                            </td>
                        `;
                    } else {
                        sequences.forEach((sequence, index) => {
                            const isLast = index === sequences.length - 1;
                            const quantity = summaryStructure.quantities[`${date}-${sequence}-${partNumber}`] || 0;
                            
                            html += `
                                <td class="px-6 py-3 text-center text-sm text-gray-900 border-r ${isLast ? 'border-gray-300' : 'border-gray-200'}">
                                    ${quantity.toLocaleString()}
                                </td>
                            `;
                        });
                    }
                });
                
                html += '</tr>';
            });
            
            // 4. 합계 행
            html += `
                <tr class="bg-gradient-to-r from-green-600 to-green-700 border-t-2 border-green-800">
                    <td class="px-6 py-3 text-sm font-bold text-white border-r border-green-800">
                        합계
                    </td>
            `;
            
            summaryStructure.dates.forEach(date => {
                const sequences = summaryStructure.dateSequences[date] || [];
                
                if (sequences.length === 0) {
                    html += `
                        <td class="px-6 py-3 text-center text-sm font-bold text-white border-r border-green-800">
                            -
                        </td>
                    `;
                } else {
                    sequences.forEach((sequence, index) => {
                        const isLast = index === sequences.length - 1;
                        const totalQuantity = summaryStructure.parts.reduce((sum, partNumber) => {
                            return sum + (summaryStructure.quantities[`${date}-${sequence}-${partNumber}`] || 0);
                        }, 0);
                        
                        html += `
                            <td class="px-6 py-3 text-center text-sm font-bold text-white border-r ${isLast ? 'border-green-800' : 'border-green-700'}">
                                ${totalQuantity.toLocaleString()}
                            </td>
                        `;
                    });
                }
            });
            
            html += '</tr>';
            
            tbody.innerHTML = html;
            console.log('가로 요약 테이블 렌더링 완료');
            
        } catch (error) {
            console.error('테이블 렌더링 중 오류:', error);
            const tbody = document.getElementById('summaryTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-red-500">
                            <div class="flex flex-col items-center">
                                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                                <p class="text-lg font-medium">테이블 렌더링 중 오류가 발생했습니다.</p>
                                <p class="text-sm mt-1">${error.message}</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // 가로 요약 테이블 구조 생성
    createHorizontalSummaryStructure(data) {
        const structure = {
            dates: [],
            dateSequences: {},
            parts: [],
            quantities: {}
        };
        
        // 날짜별로 데이터 그룹화
        const groupedByDate = {};
        data.forEach(item => {
            if (!groupedByDate[item.date]) {
                groupedByDate[item.date] = [];
            }
            groupedByDate[item.date].push(item);
        });
        
        // 날짜 정렬
        structure.dates = Object.keys(groupedByDate).sort();
        
        // 각 날짜별로 시퀀스와 파트 정보 수집
        structure.dates.forEach(date => {
            const dateData = groupedByDate[date];
            const sequences = [...new Set(dateData.map(item => item.sequence))].sort((a, b) => {
                if (a === 'AS') return 1;
                if (b === 'AS') return -1;
                return parseInt(a) - parseInt(b);
            });
            
            structure.dateSequences[date] = sequences;
            
            // 파트별 수량 정보 수집
            dateData.forEach(item => {
                const key = `${date}-${item.sequence}-${item.partNumber}`;
                structure.quantities[key] = item.actualQty || 0;
                
                // 파트 목록에 추가
                if (!structure.parts.includes(item.partNumber)) {
                    structure.parts.push(item.partNumber);
                }
            });
        });
        
        // 파트 번호 정렬
        structure.parts.sort();
        
        console.log('가로 요약 구조 생성:', structure);
        return structure;
    }

    groupDataByDate() {
        const grouped = {};
        
        this.filteredData.forEach(item => {
            if (!grouped[item.date]) {
                grouped[item.date] = [];
            }
            grouped[item.date].push(item);
        });
        
        return grouped;
    }

    groupBySequence(data) {
        const grouped = {};
        
        data.forEach(item => {
            if (!grouped[item.sequence]) {
                grouped[item.sequence] = [];
            }
            grouped[item.sequence].push(item);
        });
        
        return grouped;
    }

    updateStats() {
        try {
            // 확정된 데이터만 필터링
            const confirmedData = this.filteredData.filter(item => item.status === 'CONFIRMED');
            const totalItems = confirmedData.length;
            const totalActual = confirmedData.reduce((sum, item) => sum + (item.actualQty || 0), 0);
            const uniqueParts = [...new Set(confirmedData.map(item => item.partNumber))].length;
            const uniqueDates = [...new Set(confirmedData.map(item => item.date))].length;

            // 이번 주 출고 (최근 7일, 확정된 데이터만)
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weeklyData = confirmedData.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= oneWeekAgo;
            });
            const weeklyOutbound = weeklyData.reduce((sum, item) => sum + (item.actualQty || 0), 0);

            // 이번 달 출고 (현재 월, 확정된 데이터만)
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const monthlyData = confirmedData.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
            });
            const monthlyOutbound = monthlyData.reduce((sum, item) => sum + (item.actualQty || 0), 0);

            // DOM 요소 업데이트 (안전하게)
            const weeklyOutboundEl = document.getElementById('weeklyOutbound');
            const monthlyOutboundEl = document.getElementById('monthlyOutbound');
            const confirmedCountEl = document.getElementById('confirmedCount');
            const totalPartsEl = document.getElementById('totalParts');

            if (weeklyOutboundEl) weeklyOutboundEl.textContent = weeklyOutbound.toLocaleString();
            if (monthlyOutboundEl) monthlyOutboundEl.textContent = monthlyOutbound.toLocaleString();
            if (confirmedCountEl) confirmedCountEl.textContent = totalItems.toLocaleString();
            if (totalPartsEl) totalPartsEl.textContent = uniqueParts.toLocaleString();

            // 추가 통계 정보 (디버깅용)
            console.log('통계 업데이트:', {
                totalItems,
                totalActual,
                uniqueParts,
                uniqueDates,
                weeklyOutbound,
                monthlyOutbound
            });
        } catch (error) {
            console.error('통계 업데이트 중 오류:', error);
        }
    }

    async refreshData() {
        try {
            await this.loadData();
            this.updateStats();
            this.showNotification('데이터가 새로고침되었습니다.', 'success');
        } catch (error) {
            console.error('데이터 새로고침 중 오류:', error);
            this.showNotification('데이터 새로고침 중 오류가 발생했습니다.', 'error');
        }
    }

    exportData(format = 'excel') {
        if (format === 'excel') {
            this.exportExcel();
        }
    }



    async exportExcel() {
        try {
            console.log('=== Excel 내보내기 시작 (ExcelJS) ===');
            console.log('ExcelJS 라이브러리 확인:', typeof ExcelJS);
            console.log('현재 필터링된 데이터 수:', this.filteredData.length);
            
            // ExcelJS 라이브러리 확인
            if (typeof ExcelJS === 'undefined') {
                throw new Error('ExcelJS 라이브러리가 로드되지 않았습니다.');
            }
            
            // 워크북 생성
            const workbook = new ExcelJS.Workbook();
            console.log('워크북 생성 완료');
            
            // 메인 데이터 시트
            const mainData = this.generateExcelData();
            console.log('메인 데이터 생성 완료:', mainData.length, '행');
            console.log('메인 데이터 샘플:', mainData.slice(0, 3));
            
            const worksheet = workbook.addWorksheet('출하현황');
            console.log('워크시트 생성 완료');
            
            // 데이터 추가
            mainData.forEach((row, rowIndex) => {
                row.forEach((cellValue, colIndex) => {
                    const cell = worksheet.getCell(rowIndex + 1, colIndex + 1);
                    cell.value = cellValue;
                    
                    // 헤더 행 스타일링 (1행: 날짜, 2행: 차수)
                    if (rowIndex === 0) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF4472C4' } // 진한 파란색
                        };
                        cell.font = {
                            bold: true,
                            color: { argb: 'FFFFFFFF' }, // 흰색
                            size: 13
                        };
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    } else if (rowIndex === 1) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF5B9BD5' } // 중간 파란색
                        };
                        cell.font = {
                            bold: true,
                            color: { argb: 'FFFFFFFF' }, // 흰색
                            size: 11
                        };
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    } else if (rowIndex === mainData.length - 1) {
                        // 합계 행 스타일링
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF8C00' } // 주황색
                        };
                        cell.font = {
                            bold: true,
                            color: { argb: 'FFFFFFFF' }, // 흰색
                            size: 11
                        };
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    } else {
                        // 데이터 행 스타일링
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' // 번갈아가는 배경색
                        };
                        cell.font = {
                            size: 10
                        };
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    }
                    
                    // 모든 셀에 테두리 적용
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
            
            // 날짜 헤더 병합 설정
            if (mainData.length > 1) {
                const dateRow = mainData[0];
                let currentDate = '';
                let startCol = 1; // 0번째 컬럼은 '파트 번호'이므로 1부터 시작
                
                for (let col = 1; col < dateRow.length; col++) {
                    const cellDate = dateRow[col];
                    
                    if (cellDate !== currentDate) {
                        // 이전 날짜 범위 병합
                        if (currentDate && col > startCol) {
                            worksheet.mergeCells(1, startCol + 1, 1, col);
                            console.log('병합 범위 추가:', startCol + 1, '~', col);
                        }
                        
                        // 새 날짜 시작
                        currentDate = cellDate;
                        startCol = col;
                    }
                }
                
                // 마지막 날짜 범위 병합
                if (currentDate && dateRow.length > startCol) {
                    worksheet.mergeCells(1, startCol + 1, 1, dateRow.length);
                    console.log('마지막 병합 범위 추가:', startCol + 1, '~', dateRow.length);
                }
            }
            
            // 컬럼 너비 설정
            worksheet.getColumn(1).width = 20; // 파트 번호 컬럼
            for (let i = 2; i <= mainData[0].length; i++) {
                worksheet.getColumn(i).width = 12; // 날짜/차수 컬럼들
            }
            
            console.log('메인 시트 스타일링 완료');

            // 주말 요약 시트 추가
            const weekendSummaryData = this.generateWeekendSummaryData();
            console.log('주말 요약 데이터 생성 완료:', weekendSummaryData.length, '행');
            
            if (weekendSummaryData.length > 1) {
                const weekendWorksheet = workbook.addWorksheet('주말요약');
                console.log('주말 요약 워크시트 생성 완료');
                
                // 주말 데이터 추가
                weekendSummaryData.forEach((row, rowIndex) => {
                    row.forEach((cellValue, colIndex) => {
                        const cell = weekendWorksheet.getCell(rowIndex + 1, colIndex + 1);
                        cell.value = cellValue;
                        
                        // 헤더 행 스타일링
                        if (rowIndex === 0) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FF8E44AD' } // 보라색
                            };
                            cell.font = {
                                bold: true,
                                color: { argb: 'FFFFFFFF' },
                                size: 12
                            };
                            cell.alignment = {
                                horizontal: 'center',
                                vertical: 'middle'
                            };
                        } else {
                            // 데이터 행 스타일링
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8F4FF' // 연한 보라색
                            };
                            cell.font = {
                                size: 10
                            };
                            cell.alignment = {
                                horizontal: 'center',
                                vertical: 'middle'
                            };
                        }
                        
                        // 모든 셀에 테두리 적용
                        cell.border = {
                            top: { style: 'thin' },
                            bottom: { style: 'thin' },
                            left: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                });
                
                // 주말 시트 컬럼 너비 설정
                weekendWorksheet.getColumn(1).width = 15; // 날짜
                weekendWorksheet.getColumn(2).width = 20; // 파트 번호
                for (let i = 3; i <= 7; i++) {
                    weekendWorksheet.getColumn(i).width = 10; // 수량 컬럼들
                }
                
                console.log('주말 요약 시트 스타일링 완료');
            }
            
            // 파일 저장
            const fileName = `outbound_summary_${new Date().toISOString().split('T')[0]}.xlsx`;
            console.log('=== 파일 저장 시작 ===');
            console.log('파일명:', fileName);
            
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('=== 파일 저장 완료 ===');
            this.showNotification('출하 현황 데이터가 Excel로 내보내기되었습니다.', 'success');
        } catch (error) {
            console.error('Excel 내보내기 오류:', error);
            console.error('오류 스택:', error.stack);
            this.showNotification('Excel 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }



    generateExcelData() {
        // 확정된 데이터만 필터링
        const confirmedData = this.filteredData.filter(item => item.status === 'CONFIRMED');
        
        if (confirmedData.length === 0) {
            return [['파트 번호']];
        }
        
        // 가로 요약 구조 생성
        const summaryStructure = this.createHorizontalSummaryStructure(confirmedData);
        
        // 1행: 날짜 헤더
        const dateRow = ['파트 번호'];
        const sequenceRow = ['']; // 2행: 차수 헤더
        
        summaryStructure.dates.forEach(date => {
            const sequences = summaryStructure.dateSequences[date] || [];
            if (sequences.length === 0) {
                dateRow.push(date);
                sequenceRow.push('');
            } else {
                sequences.forEach(sequence => {
                    const dateObj = new Date(date);
                    const formattedDate = dateObj.toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                    dateRow.push(formattedDate);
                    
                    const sequenceName = sequence === 'AS' ? 'AS' : `${sequence}차`;
                    sequenceRow.push(sequenceName);
                });
            }
        });
        
        const rows = [dateRow, sequenceRow];
        
        // 파트별 데이터 행
        summaryStructure.parts.forEach(partNumber => {
            const row = [partNumber];
            
            summaryStructure.dates.forEach(date => {
                const sequences = summaryStructure.dateSequences[date] || [];
                
                if (sequences.length === 0) {
                    row.push('');
                } else {
                    sequences.forEach(sequence => {
                        const quantity = summaryStructure.quantities[`${date}-${sequence}-${partNumber}`] || 0;
                        row.push(quantity);
                    });
                }
            });
            
            rows.push(row);
        });
        
        // 합계 행
        const totalRow = ['합계'];
        summaryStructure.dates.forEach(date => {
            const sequences = summaryStructure.dateSequences[date] || [];
            
            if (sequences.length === 0) {
                totalRow.push('');
            } else {
                sequences.forEach(sequence => {
                    let total = 0;
                    summaryStructure.parts.forEach(partNumber => {
                        total += summaryStructure.quantities[`${date}-${sequence}-${partNumber}`] || 0;
                    });
                    totalRow.push(total);
                });
            }
        });
        
        rows.push(totalRow);
        
        return rows;
    }



    generateWeekendSummaryData() {
        // 확정된 데이터만 필터링
        const confirmedData = this.filteredData.filter(item => item.status === 'CONFIRMED');
        
        if (confirmedData.length === 0) {
            return [['날짜', '파트 번호', '1차', '2차', '3차', 'AS', '합계']];
        }
        
        // 주말 데이터만 필터링 (토요일=6, 일요일=0)
        const weekendData = confirmedData.filter(item => {
            const date = new Date(item.date);
            const dayOfWeek = date.getDay();
            return dayOfWeek === 0 || dayOfWeek === 6; // 일요일 또는 토요일
        });
        
        if (weekendData.length === 0) {
            return [['날짜', '파트 번호', '1차', '2차', '3차', 'AS', '합계']];
        }
        
        // 가로 요약 구조 생성 (주말 데이터만)
        const summaryStructure = this.createHorizontalSummaryStructure(weekendData);
        
        const rows = [['날짜', '파트 번호', '1차', '2차', '3차', 'AS', '합계']];
        
        // 각 주말 날짜별로 파트별 요약 생성
        summaryStructure.dates.forEach(date => {
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('ko-KR');
            const dayOfWeek = dateObj.getDay();
            const dayName = dayOfWeek === 0 ? '일요일' : '토요일';
            
            // 각 파트별로 행 생성
            summaryStructure.parts.forEach(partNumber => {
                const row = [`${formattedDate} (${dayName})`, partNumber];
                
                // 1차, 2차, 3차, AS 순서로 수량 추가
                const sequences = ['1', '2', '3', 'AS'];
                let total = 0;
                
                sequences.forEach(seq => {
                    const quantity = summaryStructure.quantities[`${date}-${seq}-${partNumber}`] || 0;
                    row.push(quantity);
                    total += quantity;
                });
                
                row.push(total); // 합계
                rows.push(row);
            });
        });
        
        return rows;
    }

    // ExcelJS를 사용한 테스트 함수
    async testExcelStyling() {
        console.log('=== ExcelJS 스타일링 테스트 ===');
        
        try {
            // 간단한 테스트 데이터 생성
            const testData = [
                ['파트 번호', '2024-01-15', '2024-01-15', '2024-01-16'],
                ['', '1차', '2차', '1차'],
                ['PART001', 10, 5, 8],
                ['PART002', 15, 3, 12],
                ['합계', 25, 8, 20]
            ];
            
            console.log('테스트 데이터:', testData);
            
            // 워크북 생성
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('테스트');
            
            // 데이터 추가 및 스타일링
            testData.forEach((row, rowIndex) => {
                row.forEach((cellValue, colIndex) => {
                    const cell = worksheet.getCell(rowIndex + 1, colIndex + 1);
                    cell.value = cellValue;
                    
                    // 헤더 행 스타일링
                    if (rowIndex === 0) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF4472C4' }
                        };
                        cell.font = {
                            bold: true,
                            color: { argb: 'FFFFFFFF' },
                            size: 13
                        };
                    } else if (rowIndex === 1) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF5B9BD5' }
                        };
                        cell.font = {
                            bold: true,
                            color: { argb: 'FFFFFFFF' },
                            size: 11
                        };
                    } else if (rowIndex === testData.length - 1) {
                        // 합계 행
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF8C00' }
                        };
                        cell.font = {
                            bold: true,
                            color: { argb: 'FFFFFFFF' },
                            size: 11
                        };
                    } else {
                        // 데이터 행
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
                        };
                        cell.font = { size: 10 };
                    }
                    
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
            });
            
            // 병합 설정
            worksheet.mergeCells(1, 2, 1, 3);
            
            // 컬럼 너비 설정
            worksheet.getColumn(1).width = 15;
            worksheet.getColumn(2).width = 12;
            worksheet.getColumn(3).width = 12;
            worksheet.getColumn(4).width = 12;
            
            // 파일 저장
            const fileName = 'test_exceljs_styling.xlsx';
            console.log('테스트 파일 저장:', fileName);
            
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('ExcelJS 스타일링 테스트 완료');
        } catch (error) {
            console.error('ExcelJS 테스트 오류:', error);
        }
    }





    updateCurrentTime() {
        try {
            // 미국 중부 시간 기준으로 현재 시간 표시
            const now = new Date();
            
            // 미국 중부 시간대 (CST/CDT)로 변환
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
            
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                timeElement.textContent = timeString + ' (CST/CDT)';
            }
        } catch (error) {
            console.error('시간 업데이트 중 오류:', error);
        }
    }

    showNotification(message, type = 'info') {
        try {
            const notification = document.createElement('div');
            notification.className = `fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
                type === 'success' ? 'bg-green-500 text-white' :
                type === 'error' ? 'bg-red-500 text-white' :
                'bg-blue-500 text-white'
            }`;
            notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
                    <span>${message}</span>
                </div>
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        } catch (error) {
            console.error('알림 표시 중 오류:', error);
            // 폴백: alert 사용
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // 기본 필터 설정
    setDefaultFilters() {
        console.log('기본 필터 설정...');
        
        try {
            const yearEl = document.getElementById('yearFilter');
            const monthEl = document.getElementById('monthFilter');
            const weekEl = document.getElementById('weekFilter');
            
            // 현재 날짜로 기본값 설정
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;
            
            // 보기 모드에 따른 기본값 설정
            if (this.currentView === 'monthly') {
                // 월별 보기: 현재 년도와 월로 설정
                if (yearEl) yearEl.value = currentYear;
                if (monthEl) monthEl.value = currentMonth;
            } else {
                // 주별 보기: 현재 주로 설정
                const currentWeek = this.getWeekNumber(currentDate);
                const currentYear = currentDate.getFullYear();
                const weekValue = `${currentYear}-W${currentWeek.toString().padStart(2, '0')}`;
                if (weekEl) weekEl.value = weekValue;
            }
            
            console.log('기본 필터 설정 완료');
            
        } catch (error) {
            console.error('기본 필터 설정 중 오류:', error);
        }
    }

    // 디바운싱된 필터 적용
    debouncedApplyFilters() {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this.filterTimeout = setTimeout(() => {
            this.applyFilters();
        }, 300);
    }

    // 디버깅용 함수 추가
    debugDataStructure() {
        console.log('=== 데이터 구조 디버깅 ===');
        console.log('전체 데이터:', this.outboundData);
        console.log('필터링된 데이터:', this.filteredData);
        console.log('확정된 데이터:', this.filteredData.filter(item => item.status === 'CONFIRMED'));
        
        if (this.filteredData.length > 0) {
            const sampleItem = this.filteredData[0];
            console.log('샘플 데이터 항목:', sampleItem);
        }
    }


}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('OutboundSummary DOM 초기화 시작...');
        window.outboundSummary = new OutboundSummary();
        console.log('OutboundSummary 인스턴스 생성 완료');
        
        // 디버깅 함수를 전역에 추가
        window.debugOutboundData = () => {
            if (window.outboundSummary) {
                window.outboundSummary.debugDataStructure();
            } else {
                console.error('OutboundSummary 인스턴스가 없습니다.');
            }
        };
        
    } catch (error) {
        console.error('OutboundSummary 초기화 중 오류:', error);
    }
}); 

// 전역 함수로 노출
window.testExcelStyling = function() {
    if (window.outboundSummary) {
        window.outboundSummary.testExcelStyling();
    } else {
        console.error('OutboundSummary 인스턴스가 없습니다.');
    }
};

// Excel 내보내기 테스트 함수 추가
window.testExcelExport = function() {
    if (window.outboundSummary) {
        console.log('=== Excel 내보내기 테스트 시작 ===');
        window.outboundSummary.exportExcel();
    } else {
        console.error('OutboundSummary 인스턴스가 없습니다.');
    }
};

// ExcelJS 라이브러리 테스트 함수
window.testExcelJSLibrary = function() {
    console.log('=== ExcelJS 라이브러리 테스트 ===');
    console.log('ExcelJS 타입:', typeof ExcelJS);
    
    if (typeof ExcelJS !== 'undefined') {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('테스트');
            
            // 간단한 데이터 추가
            worksheet.getCell('A1').value = '테스트';
            worksheet.getCell('A1').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            worksheet.getCell('A1').font = {
                bold: true,
                color: { argb: 'FFFFFFFF' }
            };
            worksheet.getCell('A1').border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
            
            console.log('ExcelJS 테스트 성공 - 스타일링 적용됨');
            return true;
        } catch (error) {
            console.error('ExcelJS 테스트 실패:', error);
            return false;
        }
    } else {
        console.error('ExcelJS 라이브러리가 로드되지 않았습니다.');
        return false;
    }
}; 