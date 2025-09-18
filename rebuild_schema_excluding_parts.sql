-- 완전한 데이터베이스 재구성 (parts 테이블 포함)
-- 모든 테이블을 삭제하고 새로운 구조로 재생성

-- 1. 모든 테이블 강제 삭제
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 2. 기본 권한 복원
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- 3. 새로운 테이블 구조 생성

-- 파트 마스터 테이블
CREATE TABLE parts (
    part_number VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255),
    category VARCHAR(100) DEFAULT 'UNKNOWN',
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 재고 현황 테이블 (단순화)
CREATE TABLE inventory (
    part_number VARCHAR(50) PRIMARY KEY,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 입출고 거래 내역 테이블 (모든 입출고 추적)
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    part_number VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_id VARCHAR(255), -- ARN 번호, 출고 시퀀스 ID 등
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 입고 컨테이너 테이블
CREATE TABLE arn_containers (
    id SERIAL PRIMARY KEY,
    arn_number VARCHAR(50) UNIQUE NOT NULL,
    container_number VARCHAR(100) NOT NULL,
    arrival_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    inbound_date TIMESTAMP WITH TIME ZONE -- 실제 입고 처리된 날짜
);

-- 입고 파트 상세 테이블
CREATE TABLE arn_parts (
    id SERIAL PRIMARY KEY,
    arn_number VARCHAR(50) NOT NULL,
    container_number VARCHAR(100) NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    scanned_quantity INTEGER DEFAULT 0 CHECK (scanned_quantity >= 0), -- 실제 스캔된 수량
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (arn_number) REFERENCES arn_containers(arn_number) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 출고 시퀀스 테이블
CREATE TABLE outbound_sequences (
    id SERIAL PRIMARY KEY,
    sequence_number VARCHAR(50) UNIQUE NOT NULL,
    outbound_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 출고 파트 테이블
CREATE TABLE outbound_parts (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    planned_qty INTEGER NOT NULL CHECK (planned_qty > 0),
    actual_qty INTEGER DEFAULT 0 CHECK (actual_qty >= 0), -- 실제 출고된 수량
    scanned_qty INTEGER DEFAULT 0 CHECK (scanned_qty >= 0), -- 실제 스캔된 수량
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (sequence_id) REFERENCES outbound_sequences(id) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 물리적 재고 실사 세션 테이블
CREATE TABLE physical_inventory_sessions (
    id SERIAL PRIMARY KEY,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 물리적 재고 실사 상세 테이블
CREATE TABLE physical_inventory_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    system_stock INTEGER NOT NULL, -- 실사 당시 시스템 재고
    physical_stock INTEGER NOT NULL, -- 실제 실사된 재고
    difference INTEGER GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ADJUSTED', 'REVIEW')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES physical_inventory_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX idx_inventory_transactions_part ON inventory_transactions(part_number);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_arn_containers_date ON arn_containers(arrival_date);
CREATE INDEX idx_arn_containers_status ON arn_containers(status);
CREATE INDEX idx_arn_parts_arn ON arn_parts(arn_number);
CREATE INDEX idx_outbound_sequences_date ON outbound_sequences(outbound_date);
CREATE INDEX idx_outbound_parts_sequence ON outbound_parts(sequence_id);
CREATE INDEX idx_physical_inventory_sessions_date ON physical_inventory_sessions(session_date);
CREATE INDEX idx_physical_inventory_items_session ON physical_inventory_items(session_id);
CREATE INDEX idx_physical_inventory_items_part ON physical_inventory_items(part_number);

-- 함수: 재고 상태 업데이트 (min_stock, max_stock 기반)
CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_stock < NEW.min_stock THEN
        NEW.status = 'low_stock';
    ELSIF NEW.current_stock = 0 THEN
        NEW.status = 'out_of_stock';
    ELSE
        NEW.status = 'in_stock';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 함수: 재고 거래 발생 시 inventory 테이블 업데이트
CREATE OR REPLACE FUNCTION track_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- inventory 테이블에 해당 part_number가 없으면 새로 생성
    INSERT INTO inventory (part_number, current_stock, last_updated)
    VALUES (NEW.part_number, 0, NOW())
    ON CONFLICT (part_number) DO NOTHING;

    IF NEW.transaction_type = 'INBOUND' THEN
        UPDATE inventory
        SET
            current_stock = current_stock + NEW.quantity,
            last_updated = NOW()
        WHERE part_number = NEW.part_number;
    ELSIF NEW.transaction_type = 'OUTBOUND' THEN
        UPDATE inventory
        SET
            current_stock = current_stock - NEW.quantity,
            last_updated = NOW()
        WHERE part_number = NEW.part_number;
    ELSIF NEW.transaction_type = 'ADJUSTMENT' THEN
        UPDATE inventory
        SET
            current_stock = current_stock + NEW.quantity, -- quantity가 양수면 증가, 음수면 감소
            last_updated = NOW()
        WHERE part_number = NEW.part_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 함수: 물리적 재고 실사 조정 처리
CREATE OR REPLACE FUNCTION process_physical_inventory_adjustment()
RETURNS TRIGGER AS $$
BEGIN
    -- 실사 항목이 'ADJUSTED' 상태로 변경될 때만 실행
    IF NEW.status = 'ADJUSTED' AND OLD.status != 'ADJUSTED' THEN
        -- inventory 테이블 업데이트
        UPDATE inventory
        SET
            current_stock = NEW.physical_stock,
            last_updated = NOW()
        WHERE part_number = NEW.part_number;

        -- inventory_transactions 테이블에 조정 기록 추가
        INSERT INTO inventory_transactions (
            transaction_date,
            part_number,
            transaction_type,
            quantity,
            reference_id,
            notes
        ) VALUES (
            NEW.created_at::DATE,
            NEW.part_number,
            'ADJUSTMENT',
            NEW.difference, -- 차이만큼 조정 (양수면 증가, 음수면 감소)
            'PHYSICAL_INV_SESSION_' || NEW.session_id,
            'Physical inventory adjustment for session ' || NEW.session_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 재고 상태 업데이트
CREATE TRIGGER trigger_update_inventory_status
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_status();

-- 트리거: inventory_transactions 삽입 시 inventory 업데이트
-- 트리거: inventory_transactions 삽입 시 inventory 자동 업데이트
-- 실사재고 및 일관성을 위해 트리거 방식 사용
CREATE TRIGGER trigger_track_inventory_movement
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION track_inventory_movement();

-- 트리거: physical_inventory_items 상태 변경 시 재고 조정
CREATE TRIGGER trigger_process_physical_inventory_adjustment
    AFTER UPDATE ON physical_inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION process_physical_inventory_adjustment();

-- RLS 정책 설정 (모든 테이블에 대해)
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE arn_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE arn_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_items ENABLE ROW LEVEL SECURITY;

-- 모든 테이블에 대한 RLS 정책 (모든 사용자 접근 허용)
-- parts 테이블에 대한 정책
CREATE POLICY "Enable all access for parts" ON parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for parts" ON parts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for parts" ON parts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for parts" ON parts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for parts" ON parts FOR DELETE USING (true);

-- inventory 테이블에 대한 정책
CREATE POLICY "Enable all access for inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Enable insert access for inventory" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for inventory" ON inventory FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for inventory" ON inventory FOR DELETE USING (true);

-- inventory_transactions 테이블에 대한 정책
CREATE POLICY "Enable all access for inventory_transactions" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for inventory_transactions" ON inventory_transactions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for inventory_transactions" ON inventory_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for inventory_transactions" ON inventory_transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for inventory_transactions" ON inventory_transactions FOR DELETE USING (true);

-- arn_containers 테이블에 대한 정책
CREATE POLICY "Enable all access for arn_containers" ON arn_containers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for arn_containers" ON arn_containers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for arn_containers" ON arn_containers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for arn_containers" ON arn_containers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for arn_containers" ON arn_containers FOR DELETE USING (true);

-- arn_parts 테이블에 대한 정책
CREATE POLICY "Enable all access for arn_parts" ON arn_parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for arn_parts" ON arn_parts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for arn_parts" ON arn_parts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for arn_parts" ON arn_parts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for arn_parts" ON arn_parts FOR DELETE USING (true);

-- outbound_sequences 테이블에 대한 정책
CREATE POLICY "Enable all access for outbound_sequences" ON outbound_sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for outbound_sequences" ON outbound_sequences FOR SELECT USING (true);
CREATE POLICY "Enable insert access for outbound_sequences" ON outbound_sequences FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for outbound_sequences" ON outbound_sequences FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for outbound_sequences" ON outbound_sequences FOR DELETE USING (true);

-- outbound_parts 테이블에 대한 정책
CREATE POLICY "Enable all access for outbound_parts" ON outbound_parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for outbound_parts" ON outbound_parts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for outbound_parts" ON outbound_parts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for outbound_parts" ON outbound_parts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for outbound_parts" ON outbound_parts FOR DELETE USING (true);

-- physical_inventory_sessions 테이블에 대한 정책
CREATE POLICY "Enable all access for physical_inventory_sessions" ON physical_inventory_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for physical_inventory_sessions" ON physical_inventory_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for physical_inventory_sessions" ON physical_inventory_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for physical_inventory_sessions" ON physical_inventory_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for physical_inventory_sessions" ON physical_inventory_sessions FOR DELETE USING (true);

-- physical_inventory_items 테이블에 대한 정책
CREATE POLICY "Enable all access for physical_inventory_items" ON physical_inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for physical_inventory_items" ON physical_inventory_items FOR SELECT USING (true);
CREATE POLICY "Enable insert access for physical_inventory_items" ON physical_inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for physical_inventory_items" ON physical_inventory_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for physical_inventory_items" ON physical_inventory_items FOR DELETE USING (true);

-- 추가: RLS를 일시적으로 비활성화하는 옵션 (개발용)
-- 권한 문제가 계속 발생하면 아래 주석을 해제하여 RLS를 비활성화하세요
ALTER TABLE parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE arn_containers DISABLE ROW LEVEL SECURITY;
ALTER TABLE arn_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_items DISABLE ROW LEVEL SECURITY;

-- 유용한 뷰 생성 (일일 현황 조회용)
CREATE VIEW daily_inventory_summary AS
SELECT 
    i.part_number,
    i.current_stock,
    i.status,
    COALESCE(inbound.today_inbound, 0) as today_inbound,
    COALESCE(outbound.today_outbound, 0) as today_outbound,
    i.last_updated
FROM inventory i
LEFT JOIN (
    SELECT part_number, SUM(quantity) as today_inbound
    FROM inventory_transactions 
    WHERE transaction_date = CURRENT_DATE AND transaction_type = 'INBOUND'
    GROUP BY part_number
) inbound ON i.part_number = inbound.part_number
LEFT JOIN (
    SELECT part_number, SUM(quantity) as today_outbound
    FROM inventory_transactions 
    WHERE transaction_date = CURRENT_DATE AND transaction_type = 'OUTBOUND'
    GROUP BY part_number
) outbound ON i.part_number = outbound.part_number;

-- RLS 상태 확인 함수
CREATE OR REPLACE FUNCTION check_rls_status(table_name text)
RETURNS text AS $$
BEGIN
    RETURN (
        SELECT CASE 
            WHEN relrowsecurity THEN 'ENABLED'
            ELSE 'DISABLED'
        END
        FROM pg_class 
        WHERE relname = table_name
    );
END;
$$ LANGUAGE plpgsql;

-- RLS 완전 비활성화 (문제 해결용)
ALTER TABLE parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE arn_containers DISABLE ROW LEVEL SECURITY;
ALTER TABLE arn_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_items DISABLE ROW LEVEL SECURITY;

-- 스키마 권한 부여
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 테이블 권한 명시적 부여
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- 개별 테이블에 대한 명시적 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON parts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON arn_containers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON arn_parts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_sequences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_parts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON physical_inventory_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON physical_inventory_items TO anon;

-- 시퀀스 권한 부여
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 함수 권한 부여
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- RLS 상태 확인
SELECT 'parts RLS 상태: ' || check_rls_status('parts') as rls_status;
SELECT 'inventory RLS 상태: ' || check_rls_status('inventory') as rls_status;

-- 권한 확인
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('parts', 'inventory', 'inventory_transactions');

-- 완료 메시지
SELECT '데이터베이스가 완전히 재구성되었습니다.' as message;