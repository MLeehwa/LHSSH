-- daily_inventory_summary 테이블 및 함수 재생성

-- 1. 기존 테이블/뷰/함수 삭제
DROP TABLE IF EXISTS daily_inventory_summary CASCADE;
DROP VIEW IF EXISTS daily_inventory_summary CASCADE;
DROP FUNCTION IF EXISTS generate_daily_inventory_summary(DATE);

-- 2. daily_inventory_summary 테이블 생성
CREATE TABLE daily_inventory_summary (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 0,
    today_inbound INTEGER DEFAULT 0,
    today_outbound INTEGER DEFAULT 0,
    calculated_stock INTEGER DEFAULT 0,
    stock_status VARCHAR(20) DEFAULT 'NORMAL',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(summary_date, part_number)
);

-- 3. 인덱스 생성
CREATE INDEX idx_daily_inventory_date ON daily_inventory_summary(summary_date);
CREATE INDEX idx_daily_inventory_part ON daily_inventory_summary(part_number);
CREATE INDEX idx_daily_inventory_date_part ON daily_inventory_summary(summary_date, part_number);

-- 4. RLS 비활성화 (테스트용)
ALTER TABLE daily_inventory_summary DISABLE ROW LEVEL SECURITY;

-- 5. 권한 부여
GRANT ALL ON daily_inventory_summary TO public;
GRANT ALL ON SEQUENCE daily_inventory_summary_id_seq TO public;

-- 6. generate_daily_inventory_summary 함수 생성
CREATE OR REPLACE FUNCTION generate_daily_inventory_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    -- 해당 날짜의 기존 데이터 삭제
    DELETE FROM daily_inventory_summary WHERE summary_date = target_date;
    
    -- 새 데이터 삽입
    INSERT INTO daily_inventory_summary (
        summary_date,
        part_number,
        current_stock,
        status,
        min_stock,
        max_stock,
        today_inbound,
        today_outbound,
        calculated_stock,
        stock_status,
        last_updated
    )
    SELECT 
        target_date as summary_date,
        i.part_number,
        i.current_stock,
        i.status,
        i.min_stock,
        i.max_stock,
        COALESCE(inbound.today_inbound, 0) as today_inbound,
        COALESCE(outbound.today_outbound, 0) as today_outbound,
        (i.current_stock - COALESCE(outbound.today_outbound, 0) + COALESCE(inbound.today_inbound, 0)) as calculated_stock,
        CASE 
            WHEN i.current_stock <= i.min_stock THEN 'LOW_STOCK'
            WHEN i.current_stock >= i.max_stock THEN 'OVERSTOCK'
            ELSE 'NORMAL'
        END as stock_status,
        i.last_updated
    FROM inventory i
    LEFT JOIN (
        -- 해당 날짜 입고 수량
        SELECT 
            part_number, 
            SUM(quantity) as today_inbound
        FROM inventory_transactions 
        WHERE transaction_date = target_date 
            AND transaction_type = 'INBOUND'
        GROUP BY part_number
    ) inbound ON i.part_number = inbound.part_number
    LEFT JOIN (
        -- 해당 날짜 출고 수량
        SELECT 
            part_number, 
            SUM(quantity) as today_outbound
        FROM inventory_transactions 
        WHERE transaction_date = target_date 
            AND transaction_type = 'OUTBOUND'
        GROUP BY part_number
    ) outbound ON i.part_number = outbound.part_number;
    
    RAISE NOTICE 'Daily inventory summary generated for date: %', target_date;
END;
$$ LANGUAGE plpgsql;

-- 7. 함수 권한 부여
GRANT EXECUTE ON FUNCTION generate_daily_inventory_summary(DATE) TO public;

-- 8. 테스트 실행
SELECT generate_daily_inventory_summary(CURRENT_DATE);

-- 9. 결과 확인
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock
FROM daily_inventory_summary 
WHERE summary_date = CURRENT_DATE
ORDER BY part_number;
