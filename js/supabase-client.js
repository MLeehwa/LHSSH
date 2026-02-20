// Supabase 클라이언트 초기화
let supabaseClient = null;

const initializeSupabase = () => {
    if (supabaseClient) {
        return supabaseClient;
    }

    // Supabase 라이브러리 확인
    if (typeof window !== 'undefined' && window.supabase) {
        try {
            // config.js에서 설정 가져오기
            const config = window.getCurrentConfig ? window.getCurrentConfig() : {
                url: 'https://vzemucykhxlxgjuldibf.supabase.co',
                anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ'
            };

            // URL 유효성 검사
            if (!config.url || !config.url.startsWith('https://')) {
                throw new Error('Supabase URL이 올바르지 않습니다.');
            }

            if (!config.anonKey) {
                throw new Error('Supabase API 키가 설정되지 않았습니다.');
            }

            console.log('Supabase 클라이언트 생성 시도:', {
                url: config.url,
                hasKey: !!config.anonKey
            });

            supabaseClient = window.supabase.createClient(
                config.url,
                config.anonKey,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    },
                    db: {
                        schema: 'public'
                    },
                    global: {
                        headers: {
                            'apikey': config.anonKey
                        }
                    }
                }
            );

            console.log('Supabase 클라이언트 초기화 성공');

            // 간단한 연결 테스트 (비동기, 에러 발생 시에도 계속 진행)
            testSupabaseConnection(supabaseClient).catch(err => {
                console.warn('Supabase 연결 테스트 실패 (계속 진행):', err);
            });

        } catch (error) {
            console.error('Supabase 클라이언트 초기화 실패:', error);
            throw error;
        }
    } else {
        console.warn('Supabase 라이브러리가 로드되지 않았습니다.');
        throw new Error('Supabase 라이브러리가 로드되지 않았습니다.');
    }
    return supabaseClient;
};

// Supabase 연결 테스트 함수
async function testSupabaseConnection(client) {
    try {
        console.log('Supabase 연결 테스트 시작...');
        const { data, error } = await client
            .from('parts')
            .select('count')
            .limit(1);

        if (error) {
            console.warn('Supabase 연결 테스트 실패:', error);

            // 프로젝트가 일시 중지된 경우를 감지
            if (error.message && (
                error.message.includes('paused') ||
                error.message.includes('suspended') ||
                error.message.includes('inactive')
            )) {
                console.error('⚠️ Supabase 프로젝트가 일시 중지된 상태입니다. 대시보드에서 프로젝트를 재개해주세요.');
            }
        } else {
            console.log('✅ Supabase 연결 테스트 성공 - 프로젝트가 활성화되어 있습니다.');
        }
    } catch (error) {
        console.warn('Supabase 연결 테스트 중 예외 발생:', error);

        // 네트워크 오류인 경우
        if (error.message && error.message.includes('Failed to fetch')) {
            console.warn('⚠️ 네트워크 오류: Supabase 프로젝트가 일시 중지되었을 수 있습니다.');
        }
    }
}

// 개발 환경용 더미 Supabase 클라이언트
const createDummySupabase = () => {
    return {
        from: (table) => ({
            select: (columns = '*') => ({
                order: (column, options = {}) => ({
                    then: (callback) => {
                        // 더미 데이터 반환
                        const dummyData = getDummyData(table);
                        setTimeout(() => callback({ data: dummyData, error: null }), 100);
                        return Promise.resolve({ data: dummyData, error: null });
                    }
                }),
                then: (callback) => {
                    const dummyData = getDummyData(table);
                    setTimeout(() => callback({ data: dummyData, error: null }), 100);
                    return Promise.resolve({ data: dummyData, error: null });
                }
            }),
            insert: (data) => ({
                select: () => ({
                    then: (callback) => {
                        const newItem = { id: Date.now(), ...data[0], created_at: new Date().toISOString() };
                        setTimeout(() => callback({ data: [newItem], error: null }), 100);
                        return Promise.resolve({ data: [newItem], error: null });
                    }
                })
            }),
            update: (data) => ({
                eq: (column, value) => ({
                    select: () => ({
                        then: (callback) => {
                            const updatedItem = { id: value, ...data, updated_at: new Date().toISOString() };
                            setTimeout(() => callback({ data: [updatedItem], error: null }), 100);
                            return Promise.resolve({ data: [updatedItem], error: null });
                        }
                    })
                })
            }),
            delete: () => ({
                eq: (column, value) => ({
                    then: (callback) => {
                        setTimeout(() => callback({ error: null }), 100);
                        return Promise.resolve({ error: null });
                    }
                })
            })
        })
    };
};

// 더미 데이터 생성
const getDummyData = (table) => {
    switch (table) {
        case 'parts':
            return [
                { id: 1, part_number: 'A-1234', description: '샤프트 부품 A', quantity: 100, location: 'A-01-01', created_at: '2024-01-15T10:00:00Z' },
                { id: 2, part_number: 'B-5678', description: '샤프트 부품 B', quantity: 50, location: 'B-02-03', created_at: '2024-01-14T15:30:00Z' },
                { id: 3, part_number: 'C-9012', description: '샤프트 부품 C', quantity: 200, location: 'C-03-02', created_at: '2024-01-13T09:15:00Z' }
            ];
        case 'arn_containers':
            return [
                { id: 1, arn_number: 'ARN-2024-001', status: 'pending', created_at: '2024-01-15T08:00:00Z' },
                { id: 2, arn_number: 'ARN-2024-002', status: 'completed', created_at: '2024-01-14T14:30:00Z' }
            ];
        case 'outbound_sequences':
            return [
                { id: 1, sequence_number: 'SEQ-2024-001', status: 'pending', created_at: '2024-01-15T11:00:00Z' },
                { id: 2, sequence_number: 'SEQ-2024-002', status: 'completed', created_at: '2024-01-14T16:45:00Z' }
            ];
        default:
            return [];
    }
};

// 공통 데이터베이스 서비스 클래스
class DatabaseService {
    constructor() {
        this.supabase = initializeSupabase();
    }

    // 에러 처리 공통 메서드
    handleError(error, context = '') {
        console.error(`Database error in ${context}:`, error);

        // 원본 에러 메시지가 있으면 포함
        let errorMessage = `데이터베이스 오류`;
        if (error.message) {
            errorMessage += `: ${error.message}`;
        } else if (error.originalError && error.originalError.message) {
            errorMessage += `: ${error.originalError.message}`;
        }

        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        throw enhancedError;
    }

    // 알림 표시 공통 메서드
    showNotification(message, type = 'info') {
        // 기존 알림 시스템과 연동
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(i18n.t('error_prefix') + message);
        }
    }
}

// 파트 관련 서비스
class PartService extends DatabaseService {
    async getAllParts(retryCount = 0) {
        const maxRetries = 2;

        try {
            // Supabase 클라이언트 확인
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
            }

            console.log(`Supabase 클라이언트 확인 완료, parts 테이블 조회 시작... (시도 ${retryCount + 1}/${maxRetries + 1})`);

            // Supabase 쿼리 실행
            const queryPromise = this.supabase
                .from('parts')
                .select('*')
                .order('created_at', { ascending: false });

            const { data, error } = await queryPromise;

            if (error) {
                console.error('Supabase 쿼리 오류:', error);

                // 특정 오류에 대해 재시도
                if (retryCount < maxRetries && (
                    error.message?.includes('Failed to fetch') ||
                    error.message?.includes('network') ||
                    error.code === 'PGRST116' // PostgREST connection error
                )) {
                    console.log(`재시도 중... (${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 지수 백오프
                    return this.getAllParts(retryCount + 1);
                }

                throw error;
            }

            console.log('파트 데이터 조회 성공, 개수:', data?.length || 0);

            // 성공 시 로컬 스토리지에 캐시 저장
            if (data && Array.isArray(data)) {
                try {
                    localStorage.setItem('parts_cache', JSON.stringify(data));
                    localStorage.setItem('parts_cache_time', Date.now().toString());
                } catch (e) {
                    console.warn('로컬 스토리지 저장 실패:', e);
                }
            }

            return data || [];
        } catch (error) {
            console.error('getAllParts 오류 상세:', {
                message: error.message,
                name: error.name,
                code: error.code,
                retryCount: retryCount
            });

            // 네트워크 오류인 경우 로컬 캐시 확인
            if (error.message && (
                error.message.includes('Failed to fetch') ||
                error.message.includes('ERR_NAME_NOT_RESOLVED') ||
                error.message.includes('network') ||
                error.message.includes('시간이 초과')
            )) {
                console.warn('네트워크 오류 발생, 로컬 캐시 확인 중...');

                // 로컬 스토리지에서 캐시된 데이터 확인 (24시간 이내)
                try {
                    const cacheTime = localStorage.getItem('parts_cache_time');
                    const cacheData = localStorage.getItem('parts_cache');

                    if (cacheTime && cacheData) {
                        const age = Date.now() - parseInt(cacheTime);
                        const maxAge = 24 * 60 * 60 * 1000; // 24시간

                        if (age < maxAge) {
                            console.log('로컬 캐시에서 데이터 로드 (오프라인 모드)');
                            const cachedParts = JSON.parse(cacheData);
                            console.warn(`⚠️ 오프라인 모드: 캐시된 데이터 사용 (${cachedParts.length}개 항목, ${Math.round(age / 1000 / 60)}분 전 데이터)`);
                            return cachedParts;
                        } else {
                            console.log('로컬 캐시가 만료되었습니다.');
                        }
                    }
                } catch (e) {
                    console.warn('로컬 캐시 읽기 실패:', e);
                }

                // 캐시가 없거나 만료된 경우 에러 발생
                let errorMessage = '❌ 네트워크 연결 실패 - Supabase 서버에 접근할 수 없습니다.\n\n';
                errorMessage += '🔍 확인 사항:\n';
                errorMessage += '1. Supabase 프로젝트가 활성화되어 있는지 확인 (https://app.supabase.com)\n';
                errorMessage += '   ⚠️ 프로젝트가 일시 중지(paused) 상태일 수 있습니다!\n';
                errorMessage += '2. 인터넷 연결 상태 확인\n';
                errorMessage += '3. diagnose-connection.html 파일로 상세 진단 실행\n';
                errorMessage += '4. 방화벽/프록시 설정 확인\n\n';
                errorMessage += '💡 Supabase 대시보드에서 프로젝트를 재개(resume)해주세요.';

                const networkError = new Error(errorMessage);
                networkError.originalError = error;
                networkError.isNetworkError = true;
                this.handleError(networkError, 'getAllParts');
            } else {
                this.handleError(error, 'getAllParts');
            }
        }
    }

    async createPart(partData) {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .insert([partData])
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            this.handleError(error, 'createPart');
        }
    }

    async updatePart(id, partData) {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .update(partData)
                .eq('id', id)
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            this.handleError(error, 'updatePart');
        }
    }

    async updatePartByPartNumber(partNumber, partData) {
        try {
            // product_type 유효성 검사
            if (partData.product_type && partData.product_type !== 'PRODUCTION' && partData.product_type !== 'AS') {
                throw new Error(`Invalid product_type: ${partData.product_type}. Must be 'PRODUCTION' or 'AS'`);
            }

            // product_type이 없으면 기본값 설정하지 않음 (기존 값 유지)
            const updateData = { ...partData };
            if (!updateData.product_type) {
                delete updateData.product_type; // 기존 값 유지를 위해 필드 제거
            }

            const { data, error } = await this.supabase
                .from('parts')
                .update(updateData)
                .eq('part_number', partNumber)
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            this.handleError(error, 'updatePartByPartNumber');
        }
    }

    async deletePart(partNumber) {
        try {
            const { error } = await this.supabase
                .from('parts')
                .delete()
                .eq('part_number', partNumber);

            if (error) throw error;
            return true;
        } catch (error) {
            this.handleError(error, 'deletePart');
        }
    }
}

// 입고 관련 서비스
class InboundService extends DatabaseService {
    async getAllARNs() {
        try {
            const { data, error } = await this.supabase
                .from('arn_containers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'getAllARNs');
        }
    }

    async createARN(arnData) {
        try {
            const { data, error } = await this.supabase
                .from('arn_containers')
                .insert([arnData])
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            this.handleError(error, 'createARN');
        }
    }

    async getARNParts(arnNumber) {
        try {
            const { data, error } = await this.supabase
                .from('arn_parts')
                .select('*')
                .eq('arn_number', arnNumber);

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'getARNParts');
        }
    }
}

// 출고 관련 서비스
class OutboundService extends DatabaseService {
    async getAllSequences() {
        try {
            const { data, error } = await this.supabase
                .from('outbound_sequences')
                .select('*')
                .order('outbound_date', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'getAllSequences');
        }
    }

    async createSequence(sequenceData) {
        try {
            const { data, error } = await this.supabase
                .from('outbound_sequences')
                .insert([sequenceData])
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            this.handleError(error, 'createSequence');
        }
    }

    async updateOutboundParts(partsData) {
        try {
            const { data, error } = await this.supabase
                .from('outbound_parts')
                .upsert(partsData)
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'updateOutboundParts');
        }
    }
}

// 재고 관련 서비스
class InventoryService extends DatabaseService {
    async getInventory() {
        try {
            const { data, error } = await this.supabase
                .from('inventory')
                .select('*')
                .order('part_number');

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'getInventory');
        }
    }

    async updateInventory(partNumber, quantity, type) {
        try {
            // 1. 현재 재고 조회
            const { data: currentInventory, error: fetchError } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .single();

            if (fetchError) throw fetchError;

            const newStock = type === 'INBOUND'
                ? currentInventory.current_stock + quantity
                : Math.max(0, currentInventory.current_stock - quantity);

            // 2. inventory 직접 UPDATE
            const { error: updateError } = await this.supabase
                .from('inventory')
                .update({
                    current_stock: newStock,
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber);

            if (updateError) throw updateError;

            // 3. 거래 내역 기록 (이력용, 트리거 무관)
            const transactionDate = new Date().toISOString().split('T')[0];
            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert([{
                    transaction_date: transactionDate,
                    part_number: partNumber,
                    transaction_type: type,
                    quantity: quantity,
                    reference_id: `${type}-${Date.now()}`
                }]);

            if (transactionError) throw transactionError;

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

            return newStock;
        } catch (error) {
            this.handleError(error, 'updateInventory');
        }
    }
}

// 서비스 인스턴스 생성
const partService = new PartService();
const inboundService = new InboundService();
const outboundService = new OutboundService();
const inventoryService = new InventoryService();

// 전역 객체로 내보내기
window.supabaseClient = initializeSupabase();
window.DatabaseService = DatabaseService;
window.PartService = PartService;
window.InboundService = InboundService;
// 전역 변수로 노출
window.supabase = supabaseClient;
window.OutboundService = OutboundService;
window.InventoryService = InventoryService;
window.partService = partService;
window.inboundService = inboundService;
window.outboundService = outboundService;
window.inventoryService = inventoryService; 