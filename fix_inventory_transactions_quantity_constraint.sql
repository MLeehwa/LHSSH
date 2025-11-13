-- Migration: Fix inventory_transactions quantity constraint to allow negative values for ADJUSTMENT
-- Date: 2024
-- Description: ADJUSTMENT 타입의 거래는 음수 quantity를 허용해야 함 (실사 재고가 시스템 재고보다 적을 때)

-- 1. 기존 제약 조건 삭제
DO $$ BEGIN
    ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_quantity_check;
EXCEPTION
    WHEN undefined_object THEN RAISE NOTICE 'Constraint inventory_transactions_quantity_check does not exist, skipping drop.';
END $$;

-- 2. 새로운 제약 조건 추가 (ADJUSTMENT는 음수 허용, INBOUND/OUTBOUND는 양수만)
-- ADJUSTMENT의 경우 음수도 허용 (실사 재고가 시스템 재고보다 적을 때)
ALTER TABLE inventory_transactions
ADD CONSTRAINT inventory_transactions_quantity_check 
CHECK (
    (transaction_type IN ('INBOUND', 'OUTBOUND') AND quantity > 0) OR
    (transaction_type = 'ADJUSTMENT' AND quantity != 0)
);

-- 3. 코멘트 추가
COMMENT ON CONSTRAINT inventory_transactions_quantity_check ON inventory_transactions IS 
'INBOUND/OUTBOUND는 양수만 허용, ADJUSTMENT는 0이 아닌 값(양수/음수) 허용';

-- 4. 확인 쿼리
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'inventory_transactions' 
AND tc.constraint_type = 'CHECK'
AND tc.constraint_name LIKE '%quantity%';

