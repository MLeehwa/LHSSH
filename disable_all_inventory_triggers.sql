-- 모든 inventory 관련 트리거 비활성화
-- 중복 삽입 및 inventory 조정 문제 해결

-- 1. inventory_transactions 삽입 시 inventory 업데이트 트리거 삭제
DROP TRIGGER IF EXISTS trigger_track_inventory_movement ON inventory_transactions;

-- 2. physical_inventory_items 업데이트 시 트리거 삭제
DROP TRIGGER IF EXISTS trigger_process_physical_inventory_adjustment ON physical_inventory_items;

-- 3. inventory 상태 업데이트 트리거 삭제 (선택사항)
-- DROP TRIGGER IF EXISTS trigger_update_inventory_status ON inventory;

-- 4. 트리거 삭제 확인
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('inventory_transactions', 'physical_inventory_items', 'inventory')
ORDER BY event_object_table, trigger_name;

-- 5. 결과 확인
-- 위 쿼리 결과가 비어있으면 모든 트리거가 성공적으로 삭제된 것입니다.
