-- daily_inventory_summary 테이블 상태 확인

-- 1. 테이블 존재 여부 확인
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'daily_inventory_summary';

-- 2. 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'daily_inventory_summary'
ORDER BY ordinal_position;

-- 3. 함수 존재 여부 확인
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'generate_daily_inventory_summary';

-- 4. 현재 데이터 확인
SELECT COUNT(*) as total_records FROM daily_inventory_summary;

-- 5. 오늘 날짜 데이터 확인
SELECT COUNT(*) as today_records 
FROM daily_inventory_summary 
WHERE summary_date = CURRENT_DATE;
