-- daily_inventory_summary 뷰 최신화
-- 이 스크립트는 기존 뷰를 삭제하고 최신 데이터로 재생성합니다

-- 기존 뷰 삭제
DROP VIEW IF EXISTS daily_inventory_summary;

-- 최신화된 daily_inventory_summary 뷰 생성
CREATE VIEW daily_inventory_summary AS
SELECT 
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

-- 뷰 생성 확인
SELECT 'daily_inventory_summary 뷰가 성공적으로 생성되었습니다.' as status;

-- 뷰 데이터 확인 (최대 10개 행)
SELECT 
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock,
    stock_status
FROM daily_inventory_summary 
ORDER BY part_number 
LIMIT 10;
