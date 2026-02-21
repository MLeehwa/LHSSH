// Outbound Summary JavaScript - Performance Optimized
class OutboundSummary {
    constructor() {
        this.outboundData = [];
        this.filteredData = [];
        this.currentView = 'monthly';
        this.selectedMonth = new Date().toISOString().slice(0, 7);
        this.supabase = null;
        this.filterTimeout = null;
        this.isCompactMode = false;

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
            this.updateCompactMode();
            this.updateStats();
            this.updateCurrentTime();

            // Performance: Use requestAnimationFrame for time updates
            this.scheduleTimeUpdate();

            console.log('OutboundSummary 초기화 완료');
        } catch (error) {
            console.error('OutboundSummary 초기화 오류:', error);
        }
    }

    initializeDropdowns() {
        try {
            console.log('드롭다운 초기화 시작...');

            // 년도 드롭다운 초기화
            const yearDropdown = document.getElementById('yearFilter');
            if (yearDropdown) {
                const currentYear = new Date().getFullYear();
                yearDropdown.innerHTML = '';

                // 최근 5년 추가
                for (let year = currentYear - 2; year <= currentYear + 2; year++) {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = `${year}년`;
                    if (year === currentYear) {
                        option.selected = true;
                    }
                    yearDropdown.appendChild(option);
                }
            }

            // 월 드롭다운 초기화
            const monthDropdown = document.getElementById('monthFilter');
            if (monthDropdown) {
                monthDropdown.innerHTML = '';
                for (let month = 1; month <= 12; month++) {
                    const option = document.createElement('option');
                    option.value = month;
                    option.textContent = `${month}월`;
                    if (month === new Date().getMonth() + 1) {
                        option.selected = true;
                    }
                    monthDropdown.appendChild(option);
                }
            }

            // 주 드롭다운 초기화
            const weekDropdown = document.getElementById('weekFilter');
            if (weekDropdown) {
                weekDropdown.innerHTML = '';
                const currentWeek = this.getWeekNumber(new Date());

                for (let week = 1; week <= 52; week++) {
                    const option = document.createElement('option');
                    option.value = week;
                    option.textContent = `${week}주차`;
                    if (week === currentWeek) {
                        option.selected = true;
                    }
                    weekDropdown.appendChild(option);
                }
            }

            console.log('드롭다운 초기화 완료');
        } catch (error) {
            console.error('드롭다운 초기화 오류:', error);
        }
    }

    updateDropdownVisibility() {
        try {
            console.log('드롭다운 가시성 업데이트 시작...');

            const monthlyDropdowns = document.getElementById('monthlyDropdowns');
            const monthlyDropdowns2 = document.getElementById('monthlyDropdowns2');
            const weeklyDropdown = document.getElementById('weeklyDropdown');

            if (this.currentView === 'monthly') {
                // 월별 보기일 때
                if (monthlyDropdowns) monthlyDropdowns.classList.remove('hidden');
                if (monthlyDropdowns2) monthlyDropdowns2.classList.remove('hidden');
                if (weeklyDropdown) weeklyDropdown.classList.add('hidden');
            } else {
                // 주별 보기일 때
                if (monthlyDropdowns) monthlyDropdowns.classList.add('hidden');
                if (monthlyDropdowns2) monthlyDropdowns2.classList.add('hidden');
                if (weeklyDropdown) weeklyDropdown.classList.remove('hidden');
            }

            console.log('드롭다운 가시성 업데이트 완료');
        } catch (error) {
            console.error('드롭다운 가시성 업데이트 오류:', error);
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
            if (e.target.closest('#refreshDataBtn')) {
                this.refreshData();
            } else if (e.target.closest('#exportBtn') || e.target.closest('#exportExcelBtn')) {
                this.exportData('excel');
            }
        });

        // Dropdown change events
        container.addEventListener('change', (e) => {
            if (e.target.matches('#viewModeToggle')) {
                const mode = e.target.value;
                if (mode === 'monthly') {
                    this.switchToMonthlyView();
                } else if (mode === 'weekly') {
                    this.switchToWeeklyView();
                }
            } else if (e.target.matches('#yearFilter, #monthFilter')) {
                this.handleMonthChange();
            } else if (e.target.matches('#weekFilter')) {
                this.handleWeekChange();
            }
        });

        // Input events
        container.addEventListener('input', (e) => {
            if (e.target.matches('#partNumberFilter')) {
                this.debouncedApplyFilters();
            }
        });

        // 컴팩트 모드 토글
        const compactModeCheckbox = document.getElementById('compactMode');
        if (compactModeCheckbox) {
            compactModeCheckbox.addEventListener('change', () => {
                this.isCompactMode = compactModeCheckbox.checked;
                this.updateCompactMode();
                this.renderTable();
            });
        }
    }

    switchToMonthlyView() {
        this.currentView = 'monthly';
        const toggle = document.getElementById('viewModeToggle');
        if (toggle) toggle.value = 'monthly';
        this.updateDropdownVisibility();
        this.applyFilters();
    }

    switchToWeeklyView() {
        this.currentView = 'weekly';
        const toggle = document.getElementById('viewModeToggle');
        if (toggle) toggle.value = 'weekly';
        this.updateDropdownVisibility();
        this.applyFilters();
    }

    handleMonthChange() {
        const year = document.getElementById('yearFilter').value;
        const month = document.getElementById('monthFilter').value;
        this.selectedMonth = `${year}-${month}`;
        console.log('월 변경 감지:', this.selectedMonth);
        // 자동으로 필터 적용
        this.applyFilters();
    }

    handleWeekChange() {
        this.applyFilters();
    }

    async loadData() {
        if (this.isLoading) return;

        const timestamp = Date.now();
        if (timestamp - this.lastDataUpdate < this.dataUpdateInterval) {
            console.log('Using cached data');
            return;
        }

        this.isLoading = true;

        try {
            console.log('데이터 로딩 시작...');

            if (!this.supabase) {
                console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
                this.showNotification('데이터베이스 연결에 실패했습니다.', 'error');
                return;
            }

            // 실제 데이터 로드

            // outbound_sequences와 outbound_parts에서 데이터 로드
            const [sequencesResult, partsResult] = await Promise.all([
                this.loadOutboundSequences(),
                this.loadOutboundParts()
            ]);

            console.log('로드된 출고 시퀀스 데이터:', sequencesResult?.length || 0);
            console.log('로드된 출고 파트 데이터:', partsResult?.length || 0);
            console.log('첫 번째 시퀀스 샘플:', sequencesResult?.[0]);
            console.log('첫 번째 파트 샘플:', partsResult?.[0]);

            this.outboundData = this.combineOutboundData(sequencesResult, partsResult);
            console.log('전체 데이터 로드:', this.outboundData.length, '개');

            this.filteredData = [...this.outboundData];

            // 현재 월로 자동 필터링
            const now = new Date();
            this.lastDataUpdate = timestamp;
            this.cache.clear();

            console.log('데이터 로드 완료. 총 데이터:', this.outboundData.length);
            console.log('첫 번째 조합된 데이터 샘플:', this.outboundData?.[0]);
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            // 필터 드롭다운 설정
            const yearEl = document.getElementById('yearFilter');
            const monthEl = document.getElementById('monthFilter');
            if (yearEl) yearEl.value = currentYear;
            if (monthEl) monthEl.value = currentMonth;

            // 필터 적용
            this.applyFilters();

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
            .select(`
                id,
                sequence_number,
                outbound_date,
                status,
                created_at
            `)
            .order('outbound_date', { ascending: false })
            .order('created_at', { ascending: false });

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
            .select(`
                id,
                sequence_id,
                part_number,
                planned_qty,
                actual_qty,
                scanned_qty,
                status,
                created_at
            `)
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

    // 더 이상 사용하지 않는 함수들 제거

    loadMockData() {
        console.log('Mock 데이터 로드 중...');
        // Mock 시퀀스 데이터
        const mockSequences = [
            {
                id: 1,
                sequence_number: '20241215-1',
                outbound_date: '2024-12-15',
                status: 'PENDING',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                sequence_number: '20241215-2',
                outbound_date: '2024-12-15',
                status: 'COMPLETED',
                created_at: new Date().toISOString()
            },
            {
                id: 3,
                sequence_number: '20241216-1',
                outbound_date: '2024-12-16',
                status: 'PENDING',
                created_at: new Date().toISOString()
            }
        ];

        // Mock 파트 데이터
        const mockParts = [
            {
                id: 1,
                sequence_id: 1,
                part_number: '49560-12345',
                planned_qty: 50,
                scanned_qty: 50,
                actual_qty: 48,
                status: 'PENDING',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                sequence_id: 1,
                part_number: '49560-67890',
                planned_qty: 30,
                scanned_qty: 30,
                actual_qty: 28,
                status: 'PENDING',
                created_at: new Date().toISOString()
            },
            {
                id: 3,
                sequence_id: 2,
                part_number: '49560-12345',
                planned_qty: 25,
                scanned_qty: 25,
                actual_qty: 25,
                status: 'COMPLETED',
                created_at: new Date().toISOString()
            },
            {
                id: 4,
                sequence_id: 2,
                part_number: '49560-67890',
                planned_qty: 20,
                scanned_qty: 20,
                actual_qty: 20,
                status: 'COMPLETED',
                created_at: new Date().toISOString()
            },
            {
                id: 5,
                sequence_id: 3,
                part_number: '49560-12345',
                planned_qty: 15,
                scanned_qty: 15,
                actual_qty: 15,
                status: 'PENDING',
                created_at: new Date().toISOString()
            }
        ];

        this.outboundData = this.combineOutboundData(mockSequences, mockParts);
        this.filteredData = [...this.outboundData];
        this.renderTable();
        this.updateStats();
    }

    // outbound_sequences와 outbound_parts 데이터를 출하 요약 데이터로 변환
    combineOutboundData(sequences, parts) {
        const combinedData = [];

        console.log('combineOutboundData 시작 - sequences:', sequences?.length || 0, 'parts:', parts?.length || 0);

        if (!sequences || !parts) {
            console.warn('시퀀스 또는 파트 데이터가 없습니다.');
            return combinedData;
        }

        // 시퀀스별로 파트들을 그룹화
        const partsBySequence = {};
        for (const part of parts) {
            if (!partsBySequence[part.sequence_id]) {
                partsBySequence[part.sequence_id] = [];
            }
            partsBySequence[part.sequence_id].push(part);
        }

        // 각 시퀀스에 대해 데이터 생성 (차수별로 그룹화)
        for (const sequence of sequences) {
            const sequenceParts = partsBySequence[sequence.id] || [];

            // 차수 번호에서 숫자 부분만 추출 (예: "20241215-1" -> "1")
            let sequenceNumber = sequence.sequence_number;
            if (sequence.sequence_number && sequence.sequence_number.includes('-')) {
                sequenceNumber = sequence.sequence_number.split('-')[1];
            }

            // 파트별로 데이터 생성하되, 상태는 시퀀스 레벨에서 가져옴
            for (const part of sequenceParts) {
                if (!part || !part.part_number) continue;

                console.log(`파트 처리 중: ${part.part_number}, 수량: ${part.actual_qty}, 시퀀스 상태: ${sequence.status}`);

                combinedData.push({
                    date: this.formatDateOnly(sequence.outbound_date) || new Date().toISOString().split('T')[0],
                    sequence: sequenceNumber,
                    partNumber: part.part_number,
                    scannedQty: part.scanned_qty || 0,
                    actualQty: part.actual_qty || 0,
                    difference: (part.scanned_qty || 0) - (part.actual_qty || 0),
                    status: sequence.status, // 시퀀스 상태를 사용 (PENDING/COMPLETED)
                    sequenceId: sequence.id,
                    partId: part.id,
                    partStatus: part.status // 파트 개별 상태는 별도로 유지
                });
            }
        }

        console.log('조합된 출하 데이터:', combinedData.length, '개 항목');
        if (combinedData.length > 0) {
            console.log('첫 번째 조합된 항목:', combinedData[0]);
        }
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

            console.log('필터 요소 확인:', {
                yearEl: !!yearEl,
                monthEl: !!monthEl,
                weekEl: !!weekEl,
                partNumberEl: !!partNumberEl,
                statusEl: !!statusEl
            });

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
                console.log('필터링 전 데이터:', filteredData.length, '개');

                filteredData = filteredData.filter(item => {
                    // 날짜를 YYYY-MM-DD 형식으로 변환하여 시간대 차이 방지
                    const itemDateStr = this.formatDateOnly(item.date);
                    if (itemDateStr === '-') return false;

                    const itemDate = new Date(itemDateStr + 'T00:00:00'); // 로컬 시간으로 명시적 설정
                    const itemYear = itemDate.getFullYear();
                    const itemMonth = itemDate.getMonth() + 1;

                    const matches = itemYear === selectedYear && itemMonth === selectedMonth;
                    if (matches) {
                        console.log('매칭된 항목:', item);
                    }

                    return matches;
                });

                console.log('월별 필터링 후:', filteredData.length, '개');
            } else {
                // 주별 보기: week 필터 사용
                const selectedWeek = weekEl ? weekEl.value : '';
                console.log(`주별 필터링: ${selectedWeek}`);

                if (selectedWeek) {
                    filteredData = filteredData.filter(item => {
                        // 날짜를 YYYY-MM-DD 형식으로 변환하여 시간대 차이 방지
                        const itemDateStr = this.formatDateOnly(item.date);
                        if (itemDateStr === '-') return false;

                        const itemDate = new Date(itemDateStr + 'T00:00:00'); // 로컬 시간으로 명시적 설정
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

            // 이미 확정된 데이터만 로드되므로 상태 필터링 불필요
            console.log('필터링된 데이터:', filteredData.length, '개');

            this.filteredData = filteredData;
            console.log(`필터링 완료: ${filteredData.length}개 항목`);
            console.log('필터링된 데이터 샘플:', filteredData.slice(0, 3));

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

    // 날짜를 YYYY-MM-DD 형식으로 변환 (시간대 차이 방지 - 로컬 시간 기준)
    formatDateOnly(dateValue) {
        try {
            if (!dateValue) return '-';

            // 이미 YYYY-MM-DD 형식인 경우
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return dateValue;
            }

            // ISO 형식인 경우 날짜 부분만 추출 (시간대 무시)
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
                // 타임스탬프가 있으면 날짜 부분만 추출 (T 이전 부분)
                const datePart = dateValue.split('T')[0];
                // YYYY-MM-DD 형식인지 확인
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    return datePart;
                }
            }

            // 날짜만 있는 문자열 형식 (예: "2024-11-03")
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
                const datePart = dateValue.substring(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    return datePart;
                }
            }

            // Date 객체로 변환 시도
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) {
                console.warn('유효하지 않은 날짜:', dateValue);
                return '-';
            }

            // 로컬 시간 기준으로 날짜 추출 (UTC가 아닌 로컬 시간대 사용)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('날짜 포맷 오류:', error, '입력값:', dateValue);
            return '-';
        }
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
            console.log('=== renderTable 시작 (날짜+차수 가로, 컴팩트) ===');

            const tbody = document.getElementById('summaryTableBody');
            const thead = document.querySelector('#summaryTable thead tr');

            if (!tbody) {
                console.error('summaryTableBody element not found');
                return;
            }

            if (!this.filteredData || this.filteredData.length === 0) {
                if (thead) thead.innerHTML = '<th class="px-4 py-3 text-left text-xs font-medium text-gray-800/80 uppercase tracking-wider">데이터 없음</th>';
                tbody.innerHTML = `
                    <tr>
                        <td colspan="35" class="px-6 py-8 text-center text-gray-500">
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

            const confirmedData = this.filteredData;
            const summaryStructure = this.createHorizontalSummaryStructure(confirmedData);

            if (!summaryStructure || summaryStructure.dates.length === 0) {
                if (thead) thead.innerHTML = '<th class="px-4 py-3 text-left text-xs font-medium text-gray-800/80 uppercase tracking-wider">데이터 없음</th>';
                tbody.innerHTML = `
                    <tr>
                        <td colspan="35" class="px-6 py-8 text-center text-gray-500">
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

            const sortedDates = [...summaryStructure.dates].sort();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            // 셀 폭: 극도로 컴팩트
            const cellW = '26px';
            const cellMax = '32px';

            // === <thead> 동적 생성 (2행: 날짜 + 차수) ===
            // 전체 컬럼 수 계산
            let totalDataCols = 0;
            sortedDates.forEach(d => {
                totalDataCols += (summaryStructure.dateSequences[d] || []).length || 1;
            });

            // 1행: 날짜 헤더 (colspan으로 차수 묶기)
            let row1 = `<th rowspan="2" class="sticky left-0 z-20 bg-blue-700 px-1 py-1 text-center text-[11px] font-bold text-white border-r border-blue-800 whitespace-nowrap" style="min-width:90px;">파트 번호</th>`;

            sortedDates.forEach(date => {
                const dateObj = new Date(date);
                dateObj.setDate(dateObj.getDate() + 1);
                const day = dateObj.getDate();
                const dow = dateObj.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const textColor = isWeekend ? 'text-red-200' : 'text-white';
                const sequences = summaryStructure.dateSequences[date] || [];
                const colSpan = sequences.length || 1;

                row1 += `<th colspan="${colSpan}" class="bg-blue-700 px-0 py-1 text-center text-[11px] font-bold ${textColor} border-r border-blue-800 whitespace-nowrap">${day}<span class="text-[9px] opacity-60 ml-0.5">${dayNames[dow]}</span></th>`;
            });

            row1 += `<th rowspan="2" class="bg-blue-900 px-1 py-1 text-center text-[11px] font-bold text-white whitespace-nowrap" style="min-width:40px;">합계</th>`;

            // 2행: 차수 서브헤더
            let row2 = '';
            sortedDates.forEach(date => {
                const sequences = summaryStructure.dateSequences[date] || [];
                if (sequences.length === 0) {
                    row2 += `<th class="bg-blue-500 px-0 py-0.5 text-center text-[9px] text-blue-100 border-r border-blue-600" style="min-width:${cellW};max-width:${cellMax};">-</th>`;
                } else {
                    sequences.forEach((seq, i) => {
                        const seqLabel = seq === 'AS' ? 'AS' : seq;
                        const borderR = i === sequences.length - 1 ? 'border-blue-800' : 'border-blue-600';
                        row2 += `<th class="bg-blue-500 px-0 py-0.5 text-center text-[9px] font-medium text-white border-r ${borderR}" style="min-width:${cellW};max-width:${cellMax};">${seqLabel}</th>`;
                    });
                }
            });

            if (thead) {
                // thead에 2행 삽입을 위해 thead 전체를 교체
                const theadEl = thead.parentElement;
                theadEl.innerHTML = `<tr>${row1}</tr><tr>${row2}</tr>`;
            }

            // === <tbody>: 파트별 행 ===
            let html = '';
            let grandTotal = 0;
            const seqDateTotals = {}; // 날짜-차수별 합계

            summaryStructure.parts.forEach((partNumber, rowIndex) => {
                const isEven = rowIndex % 2 === 0;
                const rowBg = isEven ? 'bg-gray-50' : 'bg-white';
                const stickyBg = isEven ? 'bg-gray-50' : 'bg-white';
                let partTotal = 0;

                html += `<tr class="${rowBg} hover:bg-blue-50 transition-colors border-b border-gray-100">`;
                html += `<td class="sticky left-0 z-10 ${stickyBg} px-1 py-0.5 text-[11px] font-medium text-gray-900 border-r border-gray-300 whitespace-nowrap" style="min-width:90px;">${partNumber}</td>`;

                sortedDates.forEach(date => {
                    const sequences = summaryStructure.dateSequences[date] || [];
                    if (sequences.length === 0) {
                        html += `<td class="px-0 py-0.5 text-center text-[10px] text-gray-300 border-r border-gray-200" style="min-width:${cellW};max-width:${cellMax};">-</td>`;
                    } else {
                        sequences.forEach((seq, i) => {
                            const key = `${date}-${seq}-${partNumber}`;
                            const qty = summaryStructure.quantities[key] || 0;
                            partTotal += qty;

                            // 날짜-차수 합계 누적
                            const dtKey = `${date}-${seq}`;
                            seqDateTotals[dtKey] = (seqDateTotals[dtKey] || 0) + qty;

                            const borderR = i === sequences.length - 1 ? 'border-gray-300' : 'border-gray-200';
                            const content = qty > 0 ? `<span class="text-[10px]">${qty}</span>` : '<span class="text-gray-300 text-[10px]">-</span>';
                            html += `<td class="px-0 py-0.5 text-center border-r ${borderR}" style="min-width:${cellW};max-width:${cellMax};">${content}</td>`;
                        });
                    }
                });

                grandTotal += partTotal;
                html += `<td class="px-1 py-0.5 text-center text-[10px] font-bold text-gray-900 bg-blue-50" style="min-width:40px;">${partTotal > 0 ? partTotal.toLocaleString() : '-'}</td>`;
                html += '</tr>';
            });

            // 합계 행
            html += `<tr class="bg-gradient-to-r from-green-600 to-green-700 border-t-2 border-green-800">`;
            html += `<td class="sticky left-0 z-10 bg-green-700 px-1 py-1 text-center text-[11px] font-bold text-white border-r border-green-800" style="min-width:90px;">합계</td>`;

            sortedDates.forEach(date => {
                const sequences = summaryStructure.dateSequences[date] || [];
                if (sequences.length === 0) {
                    html += `<td class="px-0 py-1 text-center text-[10px] font-bold text-white border-r border-green-700" style="min-width:${cellW};max-width:${cellMax};">-</td>`;
                } else {
                    sequences.forEach((seq, i) => {
                        const total = seqDateTotals[`${date}-${seq}`] || 0;
                        const borderR = i === sequences.length - 1 ? 'border-green-800' : 'border-green-700';
                        html += `<td class="px-0 py-1 text-center text-[10px] font-bold text-white border-r ${borderR}" style="min-width:${cellW};max-width:${cellMax};">${total > 0 ? total.toLocaleString() : '-'}</td>`;
                    });
                }
            });

            html += `<td class="px-1 py-1 text-center text-[10px] font-bold text-white bg-green-800" style="min-width:40px;">${grandTotal > 0 ? grandTotal.toLocaleString() : '-'}</td>`;
            html += '</tr>';

            tbody.innerHTML = html;
            console.log('날짜+차수 가로(컴팩트) 테이블 렌더링 완료');

        } catch (error) {
            console.error('테이블 렌더링 중 오류:', error);
            const tbody = document.getElementById('summaryTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="35" class="px-6 py-8 text-center text-red-500">
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

    // 파트 번호 정렬 함수 (이미지 순서 기준)
    sortPartNumbers(partNumbers) {
        // 정렬 순서 정의 (이미지 기준)
        const sortOrder = [
            '49560-DO000',
            '49560-L1250',
            '49560-P2600',
            '49560-R5210',
            '49560-S9420',
            '49560-S9480',
            '49600-R5000',
            '49601-R5000',
            '49600-S9000',
            '49601-S9000'
        ];

        return partNumbers.sort((a, b) => {
            const indexA = sortOrder.indexOf(a);
            const indexB = sortOrder.indexOf(b);

            // 정의된 순서에 있으면 그 순서대로
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // 둘 다 정의된 순서에 없으면 사전식 정렬
            if (indexA === -1 && indexB === -1) {
                return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
            }
            // 정의된 순서에 있는 것이 먼저
            return indexA !== -1 ? -1 : 1;
        });
    }

    // 가로 요약 테이블 구조 생성
    createHorizontalSummaryStructure(data) {
        const structure = {
            dates: [],
            dateSequences: {},
            parts: [],
            quantities: {},
            statuses: {} // 상태 정보 추가
        };

        // 날짜별로 데이터 그룹화
        const groupedByDate = {};
        data.forEach(item => {
            if (!groupedByDate[item.date]) {
                groupedByDate[item.date] = [];
            }
            groupedByDate[item.date].push(item);
        });

        // 날짜 정렬 (최신순 - 최신 날짜가 왼쪽에 표시)
        structure.dates = Object.keys(groupedByDate).sort().reverse();

        // 각 날짜별로 시퀀스와 파트 정보 수집
        structure.dates.forEach(date => {
            const dateData = groupedByDate[date];
            const sequences = [...new Set(dateData.map(item => {
                // inventory_transactions에서는 reference_id를 차수로 사용
                const seq = String(item.sequence || 'Unknown');
                console.log('처리 중인 sequence:', item.sequence, '타입:', typeof item.sequence, '문자열 변환:', seq);

                // reference_id가 숫자면 그대로 사용, 아니면 'Unknown'
                if (seq === 'Unknown' || seq === 'null' || seq === 'undefined') {
                    return 'Unknown';
                }
                return seq;
            }))].sort((a, b) => {
                if (a === 'Unknown') return 1;
                if (b === 'Unknown') return -1;
                if (a === 'AS') return 1;
                if (b === 'AS') return -1;
                return parseInt(a) - parseInt(b);
            });

            structure.dateSequences[date] = sequences;

            // 파트별 수량 정보 및 상태 수집
            dateData.forEach(item => {
                const key = `${date}-${item.sequence}-${item.partNumber}`;
                structure.quantities[key] = item.actualQty || 0;
                structure.statuses[key] = item.status || 'PENDING'; // 상태 정보 저장

                // 파트 목록에 추가
                if (!structure.parts.includes(item.partNumber)) {
                    structure.parts.push(item.partNumber);
                }
            });
        });

        // 파트 번호 정렬 (이미지 순서 기준)
        this.sortPartNumbers(structure.parts);

        console.log('가로 요약 구조 생성:', structure);
        return structure;
    }

    groupDataByDate() {
        const grouped = {};

        this.filteredData.forEach(item => {
            if (!grouped[item.outbound_date]) {
                grouped[item.outbound_date] = [];
            }
            grouped[item.outbound_date].push(item);
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
            // 완료된 데이터만 필터링 (출고 현황과 동일한 상태 체크)
            const completedData = this.filteredData.filter(item => item.status === 'COMPLETED');
            const totalItems = completedData.length;
            const totalActual = completedData.reduce((sum, item) => sum + (item.actualQty || 0), 0);
            const uniqueParts = [...new Set(completedData.map(item => item.partNumber))].length;
            const uniqueDates = [...new Set(completedData.map(item => item.date))].length;

            // 이번 주 출고 (최근 7일, 완료된 데이터만)
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            oneWeekAgo.setHours(0, 0, 0, 0); // 시간 초기화
            const weeklyData = completedData.filter(item => {
                const itemDateStr = this.formatDateOnly(item.date);
                if (itemDateStr === '-') return false;
                const itemDate = new Date(itemDateStr + 'T00:00:00'); // 로컬 시간으로 명시적 설정
                return itemDate >= oneWeekAgo;
            });
            const weeklyOutbound = weeklyData.reduce((sum, item) => sum + (item.actualQty || 0), 0);

            // 이번 달 출고 (현재 월, 완료된 데이터만)
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const monthlyData = completedData.filter(item => {
                const itemDateStr = this.formatDateOnly(item.date);
                if (itemDateStr === '-') return false;
                const itemDate = new Date(itemDateStr + 'T00:00:00'); // 로컬 시간으로 명시적 설정
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

                    // 행별 스타일링
                    if (rowIndex === 0) {
                        // 1행: 날짜 헤더
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF4472C4' }
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
                    } else if (rowIndex === 1) {
                        // 2행: 차수 서브헤더
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
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    } else if (rowIndex === mainData.length - 1) {
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
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    } else {
                        // 데이터 행
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' }
                        };
                        cell.font = { size: 10 };
                        cell.alignment = {
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    }

                    // 테두리
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // === 셀 병합 ===
            const firstRow = mainData[0];

            // 1. 날짜 헤더 가로 병합 (1행: 같은 날짜의 차수 컬럼들을 하나로)
            let mergeStartCol = null;
            for (let col = 1; col < firstRow.length; col++) {
                const cellVal = firstRow[col];
                if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
                    if (mergeStartCol !== null && (col - 1) > mergeStartCol) {
                        // 이전 그룹 병합: data[mergeStartCol..col-1] → Excel[mergeStartCol+1..col]
                        worksheet.mergeCells(1, mergeStartCol + 1, 1, col);
                    }
                    mergeStartCol = col;
                }
            }

            // 2. '파트 번호' 세로 병합 (1-2행, 첫 번째 열)
            worksheet.mergeCells(1, 1, 2, 1);

            // 3. '합계' 세로 병합 (1-2행, 마지막 열)
            const lastCol = firstRow.length;
            worksheet.mergeCells(1, lastCol, 2, lastCol);

            // 컬럼 너비 설정
            worksheet.getColumn(1).width = 20;
            for (let i = 2; i <= firstRow.length; i++) {
                worksheet.getColumn(i).width = 10;
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
                                fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8F4FF' }
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
            document.body.appendChild(link);
            link.click();
            // 브라우저가 다운로드를 시작한 후 정리
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 500);

            console.log('=== 파일 저장 완료 ===');
            this.showNotification('출하 현황 데이터가 Excel로 내보내기되었습니다.', 'success');
        } catch (error) {
            console.error('Excel 내보내기 오류:', error);
            console.error('오류 스택:', error.stack);
            this.showNotification('Excel 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }



    generateExcelData() {
        const confirmedData = this.filteredData;

        if (confirmedData.length === 0) {
            return [['파트 번호']];
        }

        const summaryStructure = this.createHorizontalSummaryStructure(confirmedData);
        const sortedDates = [...summaryStructure.dates].sort();

        // 1행: 날짜 헤더 (각 날짜에 차수만큼 셀)
        const headerRow1 = ['파트 번호'];
        // 2행: 차수 서브헤더
        const headerRow2 = [''];

        sortedDates.forEach(date => {
            const dateObj = new Date(date);
            dateObj.setDate(dateObj.getDate() + 1);
            const formattedDate = dateObj.toLocaleDateString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                weekday: 'short'
            });
            const sequences = summaryStructure.dateSequences[date] || [];
            if (sequences.length === 0) {
                headerRow1.push(formattedDate);
                headerRow2.push('-');
            } else {
                sequences.forEach((seq, i) => {
                    headerRow1.push(i === 0 ? formattedDate : '');
                    headerRow2.push(seq === 'AS' ? 'AS' : `${seq}차`);
                });
            }
        });
        headerRow1.push('합계');
        headerRow2.push('');

        const rows = [headerRow1, headerRow2];

        // 파트별 데이터 행
        const seqDateTotals = {};
        summaryStructure.parts.forEach(partNumber => {
            const row = [partNumber];
            let partTotal = 0;

            sortedDates.forEach(date => {
                const sequences = summaryStructure.dateSequences[date] || [];
                if (sequences.length === 0) {
                    row.push('');
                } else {
                    sequences.forEach(seq => {
                        const qty = summaryStructure.quantities[`${date}-${seq}-${partNumber}`] || 0;
                        partTotal += qty;
                        const dtKey = `${date}-${seq}`;
                        seqDateTotals[dtKey] = (seqDateTotals[dtKey] || 0) + qty;
                        row.push(qty || '');
                    });
                }
            });

            row.push(partTotal || '');
            rows.push(row);
        });

        // 합계 행
        const totalRow = ['합계'];
        let grandTotal = 0;
        sortedDates.forEach(date => {
            const sequences = summaryStructure.dateSequences[date] || [];
            if (sequences.length === 0) {
                totalRow.push('');
            } else {
                sequences.forEach(seq => {
                    const total = seqDateTotals[`${date}-${seq}`] || 0;
                    grandTotal += total;
                    totalRow.push(total || '');
                });
            }
        });
        totalRow.push(grandTotal || '');
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
            const date = new Date(item.outbound_date);
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
            // 날짜에 +1일 추가 (시간대 차이 보정)
            dateObj.setDate(dateObj.getDate() + 1);
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
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 500);

            console.log('ExcelJS 스타일링 테스트 완료');
        } catch (error) {
            console.error('ExcelJS 테스트 오류:', error);
        }
    }





    updateCurrentTime() {
        try {
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
        } catch (error) {
            console.error('시간 업데이트 중 오류:', error);
        }
    }

    updateCompactMode() {
        try {
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                if (this.isCompactMode) {
                    tableContainer.classList.add('compact-mode');
                } else {
                    tableContainer.classList.remove('compact-mode');
                }
            }
        } catch (error) {
            console.error('컴팩트 모드 업데이트 중 오류:', error);
        }
    }

    showNotification(message, type = 'info') {
        try {
            const notification = document.createElement('div');
            notification.className = `fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg ${type === 'success' ? 'bg-green-500 text-white' :
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
            alert(`${i18n.t(type === 'error' ? 'error_prefix' : 'success_prefix')}${message}`);
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
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('OutboundSummary DOM 초기화 시작...');
        window.outboundSummary = new OutboundSummary();
        console.log('OutboundSummary 인스턴스 생성 완료');

        // 초기화 실행
        await window.outboundSummary.init();

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
window.testExcelStyling = function () {
    if (window.outboundSummary) {
        window.outboundSummary.testExcelStyling();
    } else {
        console.error('OutboundSummary 인스턴스가 없습니다.');
    }
};

// Excel 내보내기 테스트 함수 추가
window.testExcelExport = function () {
    if (window.outboundSummary) {
        console.log('=== Excel 내보내기 테스트 시작 ===');
        window.outboundSummary.exportExcel();
    } else {
        console.error('OutboundSummary 인스턴스가 없습니다.');
    }
};

// ExcelJS 라이브러리 테스트 함수
window.testExcelJSLibrary = function () {
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