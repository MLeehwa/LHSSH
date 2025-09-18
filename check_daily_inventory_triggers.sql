-- daily_inventory_summary 관련 트리거와 함수 확인

-- 1. daily_inventory_summary 테이블 존재 확인
SELECT 
    'daily_inventory_summary 테이블' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_inventory_summary') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as status;

-- 2. 트리거 함수 존재 확인
SELECT 
    'generate_daily_inventory_summary 함수' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM pg_proc WHERE proname = 'generate_daily_inventory_summary') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as status;

-- 3. 트리거 함수 존재 확인
SELECT 
    'trigger_daily_inventory_summary 함수' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM pg_proc WHERE proname = 'trigger_daily_inventory_summary') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as status;

-- 4. inventory_transactions 테이블의 트리거 확인
SELECT 
    'inventory_transactions 트리거' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_daily_inventory_summary') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as status;

-- 5. inventory 테이블의 트리거 확인
SELECT 
    'inventory 테이블 트리거' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_daily_inventory_summary_inventory') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as status;

-- 6. daily_inventory_summary 테이블 데이터 확인
SELECT 
    'daily_inventory_summary 데이터' as check_type,
    COUNT(*) as record_count,
    MIN(summary_date) as earliest_date,
    MAX(summary_date) as latest_date
FROM daily_inventory_summary;

-- 7. 최근 inventory_transactions 확인
SELECT 
    '최근 inventory_transactions' as check_type,
    COUNT(*) as transaction_count,
    MIN(transaction_date) as earliest_date,
    MAX(transaction_date) as latest_date
FROM inventory_transactions 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 8. 오늘 날짜 daily_inventory_summary 수동 생성 테스트
SELECT generate_daily_inventory_summary(CURRENT_DATE);

-- 9. 생성 후 데이터 확인
SELECT 
    '수동 생성 후 데이터' as check_type,
    COUNT(*) as record_count
FROM daily_inventory_summary 
WHERE summary_date = CURRENT_DATE;
