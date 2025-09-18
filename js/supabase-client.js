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
        throw new Error(`데이터베이스 오류: ${error.message}`);
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
    async getAllParts() {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'getAllParts');
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
            // 트랜잭션으로 재고 업데이트 및 거래 내역 기록
            const { data: currentInventory, error: fetchError } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .single();
            
            if (fetchError) throw fetchError;

            const newStock = type === 'INBOUND' 
                ? currentInventory.current_stock + quantity
                : currentInventory.current_stock - quantity;

            // 재고 업데이트
            const { error: updateError } = await this.supabase
                .from('inventory')
                .update({ 
                    current_stock: newStock,
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber);
            
            if (updateError) throw updateError;

            // 거래 내역 기록
            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert([{
                    date: new Date().toISOString().split('T')[0],
                    part_number: partNumber,
                    type: type,
                    quantity: quantity,
                    balance_after: newStock,
                    reference_number: `${type}-${Date.now()}`
                }]);
            
            if (transactionError) throw transactionError;

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