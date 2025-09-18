-- 간단한 테스트 SQL

-- 1. 테이블 존재 확인
SELECT 
    'Table exists:' as info,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_name = 'daily_inventory_summary';

-- 2. RLS 상태 확인
SELECT 
    'RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'daily_inventory_summary';

-- 3. 기본 쿼리 테스트
SELECT 
    'Basic Query Test:' as info,
    COUNT(*) as total_records
FROM daily_inventory_summary;

-- 4. 샘플 데이터 조회
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound
FROM daily_inventory_summary 
LIMIT 3;
