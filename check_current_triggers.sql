-- 현재 트리거 상태 확인

-- 1. inventory_transactions 테이블의 모든 트리거 확인
SELECT 
    'inventory_transactions 트리거들' as check_type,
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype as trigger_type,
    tgisinternal as is_internal
FROM pg_trigger 
WHERE tgrelid = 'inventory_transactions'::regclass;

-- 2. inventory 테이블의 모든 트리거 확인
SELECT 
    'inventory 테이블 트리거들' as check_type,
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype as trigger_type,
    tgisinternal as is_internal
FROM pg_trigger 
WHERE tgrelid = 'inventory'::regclass;

-- 3. 최근 inventory_transactions 확인
SELECT 
    '최근 inventory_transactions' as check_type,
    transaction_type,
    transaction_date,
    part_number,
    quantity,
    created_at
FROM inventory_transactions 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. 최근 inventory 변경 확인
SELECT 
    '최근 inventory 변경' as check_type,
    part_number,
    current_stock,
    last_updated
FROM inventory 
ORDER BY last_updated DESC 
LIMIT 5;
