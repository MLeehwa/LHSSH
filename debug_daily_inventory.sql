-- daily_inventory_summary 디버깅을 위한 SQL

-- 1. 오늘 날짜 확인
SELECT CURRENT_DATE as today;

-- 2. 오늘 날짜의 inventory_transactions 확인
SELECT 
    transaction_date,
    part_number,
    transaction_type,
    quantity,
    reference_id,
    notes,
    created_at
FROM inventory_transactions 
WHERE transaction_date = CURRENT_DATE
ORDER BY created_at DESC;

-- 3. daily_inventory_summary 현재 상태 확인
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock,
    last_updated
FROM daily_inventory_summary 
WHERE summary_date = CURRENT_DATE
ORDER BY part_number;

-- 4. generate_daily_inventory_summary 함수 수동 실행
SELECT generate_daily_inventory_summary(CURRENT_DATE);

-- 5. 함수 실행 후 daily_inventory_summary 재확인
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock,
    last_updated
FROM daily_inventory_summary 
WHERE summary_date = CURRENT_DATE
ORDER BY part_number;
