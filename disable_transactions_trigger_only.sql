-- inventory_transactions 트리거만 비활성화
-- inventory 테이블 트리거는 유지 (재고 상태 업데이트용)

-- 1. inventory_transactions 삽입 시 inventory 업데이트 트리거만 삭제
DROP TRIGGER IF EXISTS trigger_track_inventory_movement ON inventory_transactions;

-- 2. physical_inventory_items 트리거도 삭제 (중복 삽입 방지)
DROP TRIGGER IF EXISTS trigger_process_physical_inventory_adjustment ON physical_inventory_items;

-- 3. inventory 테이블 트리거는 유지 (재고 상태 업데이트용)
-- trigger_update_inventory_status는 유지

-- 4. 트리거 삭제 확인
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('inventory_transactions', 'physical_inventory_items')
ORDER BY event_object_table, trigger_name;

-- 5. 결과 확인
-- inventory_transactions와 physical_inventory_items 관련 트리거만 삭제되어야 함
-- inventory 테이블 트리거는 유지되어야 함
