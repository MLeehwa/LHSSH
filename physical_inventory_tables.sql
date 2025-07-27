-- =====================================================
-- 실사 관리 테이블 생성
-- =====================================================

-- 1. 실사 세션 테이블 (실사 작업 단위)
CREATE TABLE IF NOT EXISTS physical_inventory_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(100) NOT NULL,
    session_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    total_parts INTEGER NOT NULL DEFAULT 0,
    completed_parts INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- 2. 실사 상세 테이블 (각 파트별 실사 결과)
CREATE TABLE IF NOT EXISTS physical_inventory_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    db_stock INTEGER NOT NULL DEFAULT 0, -- DB에 기록된 재고
    physical_stock INTEGER NOT NULL DEFAULT 0, -- 실제 실사 수량
    difference INTEGER NOT NULL DEFAULT 0, -- 차이 (physical_stock - db_stock)
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'DIFFERENCE', 'ADJUSTED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES physical_inventory_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 3. 실사 조정 내역 테이블 (재고 조정 기록)
CREATE TABLE IF NOT EXISTS physical_inventory_adjustments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    original_stock INTEGER NOT NULL, -- 조정 전 재고
    adjusted_stock INTEGER NOT NULL, -- 조정 후 재고
    adjustment_quantity INTEGER NOT NULL, -- 조정 수량 (양수: 증가, 음수: 감소)
    reason VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES physical_inventory_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_physical_inventory_sessions_date ON physical_inventory_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_sessions_status ON physical_inventory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_items_session_id ON physical_inventory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_items_part_number ON physical_inventory_items(part_number);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_items_status ON physical_inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_adjustments_session_id ON physical_inventory_adjustments(session_id);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_adjustments_part_number ON physical_inventory_adjustments(part_number);

-- RLS 정책 설정
ALTER TABLE physical_inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- 실사 세션 정책
CREATE POLICY "Allow all operations on physical_inventory_sessions" ON physical_inventory_sessions
    FOR ALL USING (true);

-- 실사 상세 정책
CREATE POLICY "Allow all operations on physical_inventory_items" ON physical_inventory_items
    FOR ALL USING (true);

-- 실사 조정 정책
CREATE POLICY "Allow all operations on physical_inventory_adjustments" ON physical_inventory_adjustments
    FOR ALL USING (true);

-- 실사 완료 시 재고 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_inventory_from_physical_count()
RETURNS TRIGGER AS $$
BEGIN
    -- 실사 항목이 조정됐을 때만 실행
    IF NEW.status = 'ADJUSTED' AND OLD.status != 'ADJUSTED' THEN
        -- inventory 테이블 업데이트
        UPDATE inventory 
        SET 
            current_stock = NEW.adjusted_stock,
            last_updated = NOW()
        WHERE part_number = NEW.part_number;
        
        -- inventory_transactions 테이블에 조정 기록 추가
        INSERT INTO inventory_transactions (
            date, 
            part_number, 
            type, 
            quantity, 
            balance_after, 
            reference_number, 
            notes
        ) VALUES (
            CURRENT_DATE,
            NEW.part_number,
            CASE 
                WHEN NEW.adjustment_quantity > 0 THEN 'INBOUND'
                ELSE 'OUTBOUND'
            END,
            ABS(NEW.adjustment_quantity),
            NEW.adjusted_stock,
            'PHYSICAL_INV_' || NEW.session_id,
            '실사 조정: ' || COALESCE(NEW.reason, '수량 차이')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_inventory_from_physical_count
    AFTER UPDATE ON physical_inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_from_physical_count();

-- 실사 세션 완료 시 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_session_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- 세션이 완료됐을 때 통계 업데이트
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        UPDATE physical_inventory_sessions 
        SET 
            completed_parts = (
                SELECT COUNT(*) 
                FROM physical_inventory_items 
                WHERE session_id = NEW.id AND status IN ('MATCHED', 'DIFFERENCE', 'ADJUSTED')
            ),
            completed_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_session_statistics
    AFTER UPDATE ON physical_inventory_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_statistics(); 