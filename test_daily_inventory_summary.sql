-- daily_inventory_summary 생성 테스트

-- 1. 현재 inventory 상태 확인
SELECT 
    '현재 inventory 상태' as check_type,
    part_number,
    current_stock,
    last_updated
FROM inventory 
ORDER BY part_number 
LIMIT 10;

-- 2. 현재 daily_inventory_summary 상태 확인
SELECT 
    '현재 daily_inventory_summary 상태' as check_type,
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock
FROM daily_inventory_summary 
ORDER BY summary_date DESC, part_number 
LIMIT 10;

-- 3. 오늘 날짜의 daily_inventory_summary 생성
SELECT generate_daily_inventory_summary(CURRENT_DATE);

-- 4. 생성 후 daily_inventory_summary 확인
SELECT 
    '생성 후 daily_inventory_summary' as check_type,
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound,
    calculated_stock
FROM daily_inventory_summary 
WHERE summary_date = CURRENT_DATE
ORDER BY part_number 
LIMIT 10;

-- 5. 전체 daily_inventory_summary 개수 확인
SELECT 
    'daily_inventory_summary 총 개수' as check_type,
    COUNT(*) as total_count,
    COUNT(DISTINCT summary_date) as date_count,
    COUNT(DISTINCT part_number) as part_count
FROM daily_inventory_summary;
