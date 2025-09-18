-- daily_inventory_summary 뷰를 테이블로 변경하고 RLS 설정
-- 단계별로 실행해야 함

-- 1단계: 기존 뷰 삭제
DROP VIEW IF EXISTS daily_inventory_summary;

-- 2단계: daily_inventory_summary 테이블 생성
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

-- 3단계: 인덱스 생성 (성능 최적화)
CREATE INDEX idx_daily_inventory_date ON daily_inventory_summary(summary_date);
CREATE INDEX idx_daily_inventory_part ON daily_inventory_summary(part_number);
CREATE INDEX idx_daily_inventory_date_part ON daily_inventory_summary(summary_date, part_number);

-- 4단계: RLS 활성화
ALTER TABLE daily_inventory_summary ENABLE ROW LEVEL SECURITY;

-- 5단계: RLS 정책 생성
CREATE POLICY "daily_inventory_summary_select_policy" ON daily_inventory_summary
    FOR SELECT
    USING (true);

CREATE POLICY "daily_inventory_summary_insert_policy" ON daily_inventory_summary
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "daily_inventory_summary_update_policy" ON daily_inventory_summary
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "daily_inventory_summary_delete_policy" ON daily_inventory_summary
    FOR DELETE
    USING (true);

-- 6단계: 일별 재고 요약 데이터 생성 함수
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

-- 7단계: 자동 일별 요약 생성 트리거 함수
CREATE OR REPLACE FUNCTION trigger_daily_inventory_summary()
RETURNS TRIGGER AS $$
DECLARE
    transaction_date DATE;
BEGIN
    -- 트랜잭션 날짜 결정
    IF TG_OP = 'DELETE' THEN
        transaction_date := OLD.transaction_date;
    ELSE
        transaction_date := NEW.transaction_date;
    END IF;
    
    -- 해당 날짜의 요약 데이터 재생성
    PERFORM generate_daily_inventory_summary(transaction_date);
    
    -- 오늘 날짜도 업데이트 (현재 재고 반영)
    PERFORM generate_daily_inventory_summary(CURRENT_DATE);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 8단계: inventory_transactions 변경 시 자동 업데이트 트리거
DROP TRIGGER IF EXISTS trg_daily_inventory_summary ON inventory_transactions;
CREATE TRIGGER trg_daily_inventory_summary
    AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_daily_inventory_summary();

-- 9단계: inventory 테이블 변경 시 자동 업데이트 트리거
DROP TRIGGER IF EXISTS trg_daily_inventory_summary_inventory ON inventory;
CREATE TRIGGER trg_daily_inventory_summary_inventory
    AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_daily_inventory_summary();

-- 10단계: 기존 데이터로 오늘 날짜 요약 생성
SELECT generate_daily_inventory_summary(CURRENT_DATE);

-- 11단계: 최근 7일간 데이터 생성 (선택사항)
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..7 LOOP
        PERFORM generate_daily_inventory_summary(CURRENT_DATE - i);
    END LOOP;
END $$;

-- 12단계: 생성된 데이터 확인
SELECT 
    'Daily inventory summary system created successfully!' as status,
    COUNT(*) as total_records,
    MIN(summary_date) as earliest_date,
    MAX(summary_date) as latest_date
FROM daily_inventory_summary;

-- 13단계: 샘플 데이터 조회
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock,
    stock_status
FROM daily_inventory_summary 
ORDER BY summary_date DESC, part_number
LIMIT 10;
