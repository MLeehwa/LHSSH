-- =====================================================
-- 바코드 시스템 데이터베이스 스키마 (간소화 버전)
-- Supabase PostgreSQL - Inventory 중심 구조
-- =====================================================

-- 기존 테이블들 삭제 (순서 중요: 외래키 참조 때문에)
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS outbound_parts CASCADE;
DROP TABLE IF EXISTS outbound_sequences CASCADE;
DROP TABLE IF EXISTS arn_parts CASCADE;
DROP TABLE IF EXISTS arn_containers CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 기존 뷰들 삭제
DROP VIEW IF EXISTS inventory_summary CASCADE;
DROP VIEW IF EXISTS daily_transaction_summary CASCADE;

-- 기존 함수들 삭제
DROP FUNCTION IF EXISTS update_inventory_status() CASCADE;
DROP FUNCTION IF EXISTS create_inventory_record() CASCADE;

-- =====================================================
-- 새로운 테이블 생성 (간소화)
-- =====================================================

-- 1. 파트 마스터 테이블 (간소화)
CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    part_number VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('INNER', 'REAR')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 재고 현황 테이블 (핵심 테이블)
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    part_number VARCHAR(50) UNIQUE NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    today_inbound INTEGER NOT NULL DEFAULT 0,
    today_outbound INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 3. 재고 거래 내역 테이블 (입출고 기록)
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('INBOUND', 'OUTBOUND')),
    quantity INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_number VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 4. 출고 차수 테이블
CREATE TABLE outbound_sequences (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    seq INTEGER NOT NULL,
    part_count INTEGER NOT NULL DEFAULT 0,
    total_scanned INTEGER NOT NULL DEFAULT 0,
    total_actual INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, seq)
);

-- 5. 출고 파트 테이블
CREATE TABLE outbound_parts (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    scanned_qty INTEGER NOT NULL DEFAULT 0,
    actual_qty INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (sequence_id) REFERENCES outbound_sequences(id) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 6. 사용자 테이블 (인증용)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'OPERATOR')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 인덱스 생성 (성능 최적화)
-- =====================================================

CREATE INDEX idx_parts_part_number ON parts(part_number);
CREATE INDEX idx_parts_category ON parts(category);
CREATE INDEX idx_parts_status ON parts(status);
CREATE INDEX idx_inventory_part_number ON inventory(part_number);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(date);
CREATE INDEX idx_inventory_transactions_part_number ON inventory_transactions(part_number);
CREATE INDEX idx_outbound_sequences_date ON outbound_sequences(date);
CREATE INDEX idx_outbound_parts_sequence_id ON outbound_parts(sequence_id);

-- =====================================================
-- 트리거 함수 및 트리거
-- =====================================================

-- 재고 상태 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 재고 상태 자동 계산 (min_stock 없이 단순화)
    IF NEW.current_stock = 0 THEN
        NEW.status = 'out_of_stock';
    ELSIF NEW.current_stock <= 10 THEN
        NEW.status = 'low_stock';
    ELSE
        NEW.status = 'in_stock';
    END IF;
    
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 재고 테이블에 트리거 적용
CREATE TRIGGER trigger_update_inventory_status
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_status();

-- 파트 생성 시 재고 레코드 자동 생성 트리거 함수
CREATE OR REPLACE FUNCTION create_inventory_record()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventory (part_number, current_stock)
    VALUES (NEW.part_number, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 파트 테이블에 트리거 적용
CREATE TRIGGER trigger_create_inventory_record
    AFTER INSERT ON parts
    FOR EACH ROW
    EXECUTE FUNCTION create_inventory_record();

-- =====================================================
-- Row Level Security (RLS) 설정
-- =====================================================

-- RLS 활성화
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 기본 정책 (모든 사용자가 읽기 가능)
CREATE POLICY "Allow read access for all users" ON parts FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON inventory FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON inventory_transactions FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON outbound_sequences FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON outbound_parts FOR SELECT USING (true);

-- 쓰기 정책 (인증된 사용자만)
CREATE POLICY "Allow insert for authenticated users" ON parts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON parts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow delete for authenticated users" ON parts FOR DELETE USING (auth.role() = 'authenticated');

-- inventory 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON inventory FOR UPDATE USING (auth.role() = 'authenticated');

-- inventory_transactions 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON inventory_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON inventory_transactions FOR UPDATE USING (auth.role() = 'authenticated');

-- outbound_sequences 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON outbound_sequences FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON outbound_sequences FOR UPDATE USING (auth.role() = 'authenticated');

-- outbound_parts 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON outbound_parts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON outbound_parts FOR UPDATE USING (auth.role() = 'authenticated');

-- =====================================================
-- 샘플 데이터 삽입
-- =====================================================

-- 샘플 파트 데이터
INSERT INTO parts (part_number, category, status) VALUES
('49560-12345', 'INNER', 'ACTIVE'),
('49600-67890', 'REAR', 'ACTIVE'),
('49560-11111', 'INNER', 'ACTIVE'),
('49601-22222', 'REAR', 'ACTIVE');

-- =====================================================
-- 뷰 생성 (데이터 조회 최적화)
-- =====================================================

-- 재고 현황 요약 뷰 (간소화)
CREATE VIEW inventory_summary AS
SELECT 
    p.part_number,
    p.category,
    p.status as part_status,
    i.current_stock,
    i.status as inventory_status,
    i.today_inbound,
    i.today_outbound,
    i.last_updated
FROM parts p
LEFT JOIN inventory i ON p.part_number = i.part_number
WHERE p.status = 'ACTIVE';

-- 일일 거래 요약 뷰
CREATE VIEW daily_transaction_summary AS
SELECT 
    date,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN type = 'INBOUND' THEN quantity ELSE 0 END) as total_inbound,
    SUM(CASE WHEN type = 'OUTBOUND' THEN quantity ELSE 0 END) as total_outbound
FROM inventory_transactions
GROUP BY date
ORDER BY date DESC;