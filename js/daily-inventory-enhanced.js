/**
 * Enhanced Daily Inventory Management
 * 일별 재고 요약 데이터를 HTML에서 조회할 수 있도록 개선
 */

class DailyInventoryEnhanced {
    constructor() {
        this.currentDate = new Date().toISOString().split('T')[0];
        this.dateRange = 7; // 기본 7일간 조회
        this.init();
    }

    async init() {
        console.log('=== Enhanced Daily Inventory System 초기화 ===');
        
        // Supabase 클라이언트 확인
        if (typeof window.supabase === 'undefined' || !window.supabase.from) {
            console.error('Supabase 클라이언트가 로드되지 않았습니다.');
            return;
        }
        
        // 간단한 연결 테스트
        await this.testConnection();
        
        await this.loadDailyInventoryData();
        this.setupEventListeners();
    }

    /**
     * Supabase 연결 테스트
     */
    async testConnection() {
        try {
            console.log('=== Supabase 연결 테스트 시작 ===');
            
            // 간단한 쿼리로 연결 테스트
            const { data, error } = await window.supabase
                .from('daily_inventory_summary')
                .select('count')
                .limit(1);
            
            if (error) {
                console.error('연결 테스트 실패:', error);
                return false;
            }
            
            console.log('연결 테스트 성공:', data);
            return true;
        } catch (error) {
            console.error('연결 테스트 중 오류:', error);
            return false;
        }
    }

    /**
     * 일별 재고 요약 데이터 로드
     */
    async loadDailyInventoryData(targetDate = null) {
        try {
            const date = targetDate || this.currentDate;
            console.log(`일별 재고 데이터 로드: ${date}`);

            // Supabase 클라이언트 확인
            if (!window.supabase || !window.supabase.from) {
                console.error('Supabase 클라이언트가 올바르게 초기화되지 않았습니다.');
                return [];
            }

            console.log('Supabase 클라이언트 상태:', {
                exists: !!window.supabase,
                hasFrom: !!(window.supabase && window.supabase.from),
                config: window.getCurrentConfig ? window.getCurrentConfig() : 'No config'
            });

            const { data, error } = await window.supabase
                .from('daily_inventory_summary')
                .select('*')
                .eq('summary_date', date)
                .order('part_number');

            if (error) {
                console.error('일별 재고 데이터 로드 오류:', error);
                console.error('오류 상세:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                if (error.code === '42501') {
                    console.error('권한 오류: daily_inventory_summary 테이블에 대한 RLS 정책을 확인하세요.');
                    console.error('SQL 실행 필요: fix_daily_inventory_rls.sql');
                } else if (error.code === 'PGRST301' || error.message.includes('401')) {
                    console.error('인증 오류: Supabase API 키를 확인하세요.');
                }
                throw error;
            }

            console.log(`${date} 일별 재고 데이터:`, data);
            return data;
        } catch (error) {
            console.error('일별 재고 데이터 로드 실패:', error);
            return [];
        }
    }

    /**
     * 날짜 범위별 재고 데이터 로드
     */
    async loadDateRangeInventoryData(startDate, endDate) {
        try {
            console.log(`날짜 범위 재고 데이터 로드: ${startDate} ~ ${endDate}`);

            if (!window.supabase || !window.supabase.from) {
                console.error('Supabase 클라이언트가 올바르게 초기화되지 않았습니다.');
                return [];
            }

            const { data, error } = await window.supabase
                .from('daily_inventory_summary')
                .select('*')
                .gte('summary_date', startDate)
                .lte('summary_date', endDate)
                .order('summary_date', { ascending: false })
                .order('part_number');

            if (error) {
                console.error('날짜 범위 재고 데이터 로드 오류:', error);
                throw error;
            }

            console.log(`날짜 범위 재고 데이터:`, data);
            return data;
        } catch (error) {
            console.error('날짜 범위 재고 데이터 로드 실패:', error);
            return [];
        }
    }

    /**
     * 특정 파트의 일별 재고 변화 추적
     */
    async getPartInventoryHistory(partNumber, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const startDateStr = startDate.toISOString().split('T')[0];

            console.log(`파트 ${partNumber} 재고 이력 조회: ${startDateStr} ~ ${this.currentDate}`);

            if (!window.supabase || !window.supabase.from) {
                console.error('Supabase 클라이언트가 올바르게 초기화되지 않았습니다.');
                return [];
            }

            const { data, error } = await window.supabase
                .from('daily_inventory_summary')
                .select('*')
                .eq('part_number', partNumber)
                .gte('summary_date', startDateStr)
                .order('summary_date', { ascending: true });

            if (error) {
                console.error('파트 재고 이력 조회 오류:', error);
                throw error;
            }

            console.log(`파트 ${partNumber} 재고 이력:`, data);
            return data;
        } catch (error) {
            console.error('파트 재고 이력 조회 실패:', error);
            return [];
        }
    }

    /**
     * 재고 상태별 통계 조회
     */
    async getInventoryStats(targetDate = null) {
        try {
            const date = targetDate || this.currentDate;
            console.log(`재고 통계 조회: ${date}`);

            if (!window.supabase || !window.supabase.from) {
                console.error('Supabase 클라이언트가 올바르게 초기화되지 않았습니다.');
                return { date: targetDate, stats: {}, details: [] };
            }

            const { data, error } = await window.supabase
                .from('daily_inventory_summary')
                .select('stock_status, part_number, current_stock, today_inbound, today_outbound')
                .eq('summary_date', date);

            if (error) {
                console.error('재고 통계 조회 오류:', error);
                if (error.code === '42501') {
                    console.error('권한 오류: daily_inventory_summary 테이블에 대한 RLS 정책을 확인하세요.');
                    console.error('SQL 실행 필요: fix_daily_inventory_rls.sql');
                }
                throw error;
            }

            // 통계 계산
            const stats = {
                totalParts: data.length,
                lowStock: data.filter(item => item.stock_status === 'LOW_STOCK').length,
                overStock: data.filter(item => item.stock_status === 'OVERSTOCK').length,
                normalStock: data.filter(item => item.stock_status === 'NORMAL').length,
                totalCurrentStock: data.reduce((sum, item) => sum + (item.current_stock || 0), 0),
                totalInbound: data.reduce((sum, item) => sum + (item.today_inbound || 0), 0),
                totalOutbound: data.reduce((sum, item) => sum + (item.today_outbound || 0), 0)
            };

            console.log(`${date} 재고 통계:`, stats);
            return { date, stats, details: data };
        } catch (error) {
            console.error('재고 통계 조회 실패:', error);
            return { date: targetDate, stats: {}, details: [] };
        }
    }

    /**
     * 일별 재고 요약 데이터 수동 생성
     */
    async generateDailySummary(targetDate = null) {
        try {
            const date = targetDate || this.currentDate;
            console.log(`일별 재고 요약 생성: ${date}`);

            if (!window.supabase || !window.supabase.rpc) {
                console.error('Supabase 클라이언트가 올바르게 초기화되지 않았습니다.');
                return false;
            }

            // Supabase 함수 호출
            const { data, error } = await window.supabase.rpc('generate_daily_inventory_summary', {
                target_date: date
            });

            if (error) {
                console.error('일별 재고 요약 생성 오류:', error);
                throw error;
            }

            console.log(`${date} 일별 재고 요약 생성 완료`);
            return true;
        } catch (error) {
            console.error('일별 재고 요약 생성 실패:', error);
            return false;
        }
    }

    /**
     * HTML 테이블 렌더링
     */
    renderInventoryTable(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`컨테이너를 찾을 수 없습니다: ${containerId}`);
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<p class="text-gray-500">${i18n.t('no_data')}</p>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'min-w-full bg-white shadow-md rounded-lg overflow-hidden';
        
        // 테이블 헤더
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        thead.innerHTML = `
            <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">파트번호</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">현재재고</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입고</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출고</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">계산재고</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">업데이트</th>
            </tr>
        `;

        // 테이블 바디
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        data.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            const statusClass = this.getStatusClass(item.stock_status);
            const difference = item.calculated_stock - item.current_stock;
            const differenceText = difference !== 0 ? `(${difference > 0 ? '+' : ''}${difference})` : '';
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.part_number}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.current_stock}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                    ${item.today_inbound || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                    ${item.today_outbound || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.calculated_stock} ${differenceText}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                        ${this.getStatusText(item.stock_status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(item.last_updated).toLocaleString()}
                </td>
            `;
            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);
    }

    /**
     * 통계 카드 렌더링
     */
    renderStatsCards(stats, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-boxes text-2xl text-blue-500"></i>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">총 파트 수</dt>
                                    <dd class="text-lg font-medium text-gray-900">${stats.totalParts}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-exclamation-triangle text-2xl text-red-500"></i>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">재고 부족</dt>
                                    <dd class="text-lg font-medium text-red-600">${stats.lowStock}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-arrow-up text-2xl text-green-500"></i>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">오늘 입고</dt>
                                    <dd class="text-lg font-medium text-green-600">${stats.totalInbound}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-arrow-down text-2xl text-orange-500"></i>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">오늘 출고</dt>
                                    <dd class="text-lg font-medium text-orange-600">${stats.totalOutbound}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 상태별 클래스 반환
     */
    getStatusClass(status) {
        switch (status) {
            case 'LOW_STOCK':
                return 'bg-red-100 text-red-800';
            case 'OVERSTOCK':
                return 'bg-yellow-100 text-yellow-800';
            case 'NORMAL':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    /**
     * 상태 텍스트 반환
     */
    getStatusText(status) {
        switch (status) {
            case 'LOW_STOCK':
                return '재고부족';
            case 'OVERSTOCK':
                return '재고보유';
            case 'NORMAL':
                return '정상';
            default:
                return '알수없음';
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 날짜 변경 이벤트
        document.addEventListener('change', (e) => {
            if (e.target.id === 'inventoryDate') {
                this.currentDate = e.target.value;
                this.loadAndRenderInventory();
            }
        });

        // 새로고침 버튼
        document.addEventListener('click', (e) => {
            if (e.target.id === 'refreshInventory') {
                this.loadAndRenderInventory();
            }
        });
    }

    /**
     * 재고 데이터 로드 및 렌더링
     */
    async loadAndRenderInventory() {
        try {
            const data = await this.loadDailyInventoryData();
            const stats = await this.getInventoryStats();
            
            this.renderInventoryTable(data, 'inventoryTableContainer');
            this.renderStatsCards(stats.stats, 'statsCardsContainer');
        } catch (error) {
            console.error('재고 데이터 로드 및 렌더링 실패:', error);
        }
    }
}

// 전역 함수로 노출
window.DailyInventoryEnhanced = DailyInventoryEnhanced;

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    // Supabase 로드 확인 후 초기화
    const initDailyInventory = () => {
        if (typeof window.supabase !== 'undefined' && window.supabase.from) {
            console.log('Supabase 클라이언트 확인됨, DailyInventoryEnhanced 초기화 시작');
            window.dailyInventory = new DailyInventoryEnhanced();
        } else {
            console.log('Supabase 클라이언트 대기 중...');
            setTimeout(initDailyInventory, 500);
        }
    };
    
    initDailyInventory();
});
