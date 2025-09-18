-- daily_inventory_summary 뷰만 수정 (날짜별 구분 가능하도록)
-- 기존 뷰를 삭제하고 날짜 컬럼을 추가한 새 뷰로 교체

-- 1. 기존 뷰 삭제
DROP VIEW IF EXISTS daily_inventory_summary;

-- 2. 날짜별 구분 가능한 새 뷰 생성
CREATE VIEW daily_inventory_summary AS
SELECT 
    CURRENT_DATE as summary_date,  -- 날짜 컬럼 추가
    i.part_number,
    i.current_stock,
    i.status,
    i.min_stock,
    i.max_stock,
    COALESCE(inbound.today_inbound, 0) as today_inbound,
    COALESCE(outbound.today_outbound, 0) as today_outbound,
    i.last_updated,
    -- 추가 통계 정보
    (i.current_stock - COALESCE(outbound.today_outbound, 0) + COALESCE(inbound.today_inbound, 0)) as calculated_stock,
    CASE 
        WHEN i.current_stock <= i.min_stock THEN 'LOW_STOCK'
        WHEN i.current_stock >= i.max_stock THEN 'OVERSTOCK'
        ELSE 'NORMAL'
    END as stock_status
FROM inventory i
LEFT JOIN (
    -- 오늘 입고 수량
    SELECT 
        part_number, 
        SUM(quantity) as today_inbound
    FROM inventory_transactions 
    WHERE transaction_date = CURRENT_DATE 
        AND transaction_type = 'INBOUND'
    GROUP BY part_number
) inbound ON i.part_number = inbound.part_number
LEFT JOIN (
    -- 오늘 출고 수량
    SELECT 
        part_number, 
        SUM(quantity) as today_outbound
    FROM inventory_transactions 
    WHERE transaction_date = CURRENT_DATE 
        AND transaction_type = 'OUTBOUND'
    GROUP BY part_number
) outbound ON i.part_number = outbound.part_number;

-- 3. 뷰 생성 확인
SELECT 'daily_inventory_summary 뷰가 성공적으로 수정되었습니다.' as status;

-- 4. 수정된 뷰 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'daily_inventory_summary'
ORDER BY ordinal_position;

-- 5. 샘플 데이터 확인 (최대 5개 행)
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock,
    stock_status
FROM daily_inventory_summary 
ORDER BY part_number 
LIMIT 5;
