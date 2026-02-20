-- ============================================
-- 재고 트리거 비활성화 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================

-- 1. 먼저 어떤 사용자 트리거가 있는지 확인
SELECT 
    tgname AS trigger_name,
    tgtype,
    tgenabled,
    pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'inventory_transactions'::regclass
  AND NOT tgisinternal;

-- 2. 특정 트리거 비활성화 (이름을 알고 있는 경우)
DROP TRIGGER IF EXISTS track_inventory_movement ON inventory_transactions;
DROP TRIGGER IF EXISTS update_inventory_on_transaction ON inventory_transactions;
DROP TRIGGER IF EXISTS inventory_transaction_trigger ON inventory_transactions;
DROP TRIGGER IF EXISTS after_inventory_transaction ON inventory_transactions;

-- 3. 사용자 정의 트리거만 비활성화 (시스템 트리거 제외)
ALTER TABLE inventory_transactions DISABLE TRIGGER USER;

-- ⚠️ 주의: 위 명령은 사용자가 만든 트리거만 비활성화합니다.
-- 시스템 트리거(FK 제약조건 등)는 영향받지 않습니다.
-- 코드에서 직접 inventory.current_stock을 업데이트하므로 트리거가 필요 없습니다.
