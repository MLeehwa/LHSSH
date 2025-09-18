-- inventory_transactions 트리거 완전 비활성화
-- JavaScript에서만 inventory를 관리하도록 함 (인바운드/아웃바운드 모두)

-- 1. 모든 관련 트리거 삭제
DROP TRIGGER IF EXISTS trg_update_inventory_from_transaction ON inventory_transactions;
DROP TRIGGER IF EXISTS update_inventory_trigger ON inventory_transactions;
DROP TRIGGER IF EXISTS inventory_transaction_trigger ON inventory_transactions;

-- 2. 트리거 함수들 삭제
DROP FUNCTION IF EXISTS update_inventory_from_transaction();
DROP FUNCTION IF EXISTS update_inventory_on_transaction();

-- 3. 모든 트리거 비활성화 확인
SELECT 
    'inventory_transactions 모든 트리거 상태' as check_type,
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype as trigger_type
FROM pg_trigger 
WHERE tgrelid = 'inventory_transactions'::regclass;

-- 4. inventory 테이블 트리거도 확인
SELECT 
    'inventory 테이블 트리거 상태' as check_type,
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype as trigger_type
FROM pg_trigger 
WHERE tgrelid = 'inventory'::regclass;

-- 5. 현재 inventory 상태 확인
SELECT 
    '현재 inventory 상태' as check_type,
    part_number,
    current_stock,
    last_updated
FROM inventory 
ORDER BY last_updated DESC 
LIMIT 5;

-- 6. 최근 inventory_transactions 확인
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
