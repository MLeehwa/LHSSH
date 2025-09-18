-- 일일 재고 스냅샷 테이블 생성
-- 매일 자정에 실행하여 전일 재고 상태를 저장

-- 일일 재고 스냅샷 테이블
CREATE TABLE IF NOT EXISTS daily_inventory_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    opening_stock INTEGER NOT NULL DEFAULT 0,  -- 시작 재고 (전일 종료 재고)
    closing_stock INTEGER NOT NULL DEFAULT 0,  -- 종료 재고 (당일 종료 재고)
    daily_inbound INTEGER NOT NULL DEFAULT 0,  -- 일일 입고 수량
    daily_outbound INTEGER NOT NULL DEFAULT 0, -- 일일 출고 수량
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(snapshot_date, part_number),
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_inventory_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_part ON daily_inventory_snapshots(part_number);

-- 일일 스냅샷 생성 함수
CREATE OR REPLACE FUNCTION create_daily_inventory_snapshot(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
    snapshot_count INTEGER;
BEGIN
    -- 해당 날짜의 스냅샷이 이미 있는지 확인
    SELECT COUNT(*) INTO snapshot_count 
    FROM daily_inventory_snapshots 
    WHERE snapshot_date = target_date;
    
    IF snapshot_count > 0 THEN
        RETURN '해당 날짜의 스냅샷이 이미 존재합니다: ' || target_date;
    END IF;
    
    -- 전일 종료 재고를 시작 재고로 설정
    INSERT INTO daily_inventory_snapshots (
        snapshot_date, 
        part_number, 
        opening_stock, 
        closing_stock, 
        daily_inbound, 
        daily_outbound
    )
    SELECT 
        target_date,
        i.part_number,
        i.current_stock as opening_stock,
        i.current_stock as closing_stock,
        COALESCE(inbound.daily_qty, 0) as daily_inbound,
        COALESCE(outbound.daily_qty, 0) as daily_outbound
    FROM inventory i
    LEFT JOIN (
        SELECT 
            part_number, 
            SUM(quantity) as daily_qty
        FROM inventory_transactions 
        WHERE transaction_date = target_date 
            AND transaction_type = 'INBOUND'
        GROUP BY part_number
    ) inbound ON i.part_number = inbound.part_number
    LEFT JOIN (
        SELECT 
            part_number, 
            SUM(quantity) as daily_qty
        FROM inventory_transactions 
        WHERE transaction_date = target_date 
            AND transaction_type = 'OUTBOUND'
        GROUP BY part_number
    ) outbound ON i.part_number = outbound.part_number;
    
    GET DIAGNOSTICS snapshot_count = ROW_COUNT;
    
    RETURN '일일 재고 스냅샷이 생성되었습니다: ' || snapshot_count || '개 파트, 날짜: ' || target_date;
END;
$$ LANGUAGE plpgsql;

-- 오늘 스냅샷 생성
SELECT create_daily_inventory_snapshot(CURRENT_DATE);

-- 스냅샷 확인
SELECT 
    snapshot_date,
    COUNT(*) as part_count,
    SUM(daily_inbound) as total_inbound,
    SUM(daily_outbound) as total_outbound
FROM daily_inventory_snapshots 
WHERE snapshot_date = CURRENT_DATE
GROUP BY snapshot_date;
