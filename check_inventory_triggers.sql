-- inventory 테이블의 트리거와 함수 확인

-- 1. inventory_transactions 테이블의 트리거 확인
SELECT 
    'inventory_transactions 트리거들' as check_type,
    tgname as trigger_name,
    tgtype as trigger_type,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'inventory_transactions'::regclass;

-- 2. inventory 테이블의 트리거 확인
SELECT 
    'inventory 테이블 트리거들' as check_type,
    tgname as trigger_name,
    tgtype as trigger_type,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'inventory'::regclass;

-- 3. inventory_transactions 업데이트 함수 확인
SELECT 
    'inventory_transactions 업데이트 함수들' as check_type,
    proname as function_name,
    prokind as function_type
FROM pg_proc 
WHERE proname LIKE '%inventory%' OR proname LIKE '%stock%';

-- 4. 최근 inventory_transactions 확인
SELECT 
    '최근 inventory_transactions' as check_type,
    transaction_type,
    COUNT(*) as count,
    SUM(quantity) as total_quantity
FROM inventory_transactions 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY transaction_type;

-- 5. inventory 테이블의 current_stock 확인
SELECT 
    'inventory current_stock' as check_type,
    part_number,
    current_stock,
    last_updated
FROM inventory 
ORDER BY last_updated DESC 
LIMIT 10;

-- 6. 트리거 함수 생성 (만약 없다면)
CREATE OR REPLACE FUNCTION update_inventory_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- INBOUND: 재고 증가
    IF NEW.transaction_type = 'INBOUND' THEN
        UPDATE inventory 
        SET current_stock = current_stock + NEW.quantity,
            last_updated = CURRENT_TIMESTAMP
        WHERE part_number = NEW.part_number;
        
        -- 파트가 없으면 새로 생성
        IF NOT FOUND THEN
            INSERT INTO inventory (part_number, current_stock, status, last_updated)
            VALUES (NEW.part_number, NEW.quantity, 'in_stock', CURRENT_TIMESTAMP);
        END IF;
    END IF;
    
    -- OUTBOUND: 재고 감소
    IF NEW.transaction_type = 'OUTBOUND' THEN
        UPDATE inventory 
        SET current_stock = current_stock - NEW.quantity,
            last_updated = CURRENT_TIMESTAMP
        WHERE part_number = NEW.part_number;
        
        -- 재고가 음수가 되지 않도록 보장
        UPDATE inventory 
        SET current_stock = GREATEST(current_stock, 0)
        WHERE part_number = NEW.part_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 트리거 생성 (만약 없다면)
DROP TRIGGER IF EXISTS trg_update_inventory_from_transaction ON inventory_transactions;
CREATE TRIGGER trg_update_inventory_from_transaction
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_from_transaction();

-- 8. 트리거 생성 확인
SELECT 
    '생성된 트리거' as check_type,
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trg_update_inventory_from_transaction';

-- 9. 테스트용 트랜잭션 삽입 (테스트 후 삭제)
INSERT INTO inventory_transactions (
    transaction_date, 
    part_number, 
    transaction_type, 
    quantity, 
    reference_id, 
    notes
) VALUES (
    CURRENT_DATE, 
    'TEST-PART-001', 
    'INBOUND', 
    10, 
    'TEST-' || EXTRACT(EPOCH FROM NOW()), 
    '트리거 테스트용'
);

-- 10. 테스트 결과 확인
SELECT 
    '테스트 결과' as check_type,
    part_number,
    current_stock
FROM inventory 
WHERE part_number = 'TEST-PART-001';

-- 11. 테스트 데이터 정리
DELETE FROM inventory_transactions WHERE part_number = 'TEST-PART-001';
DELETE FROM inventory WHERE part_number = 'TEST-PART-001';
