-- 실사 관련 중복 삽입 방지를 위한 트리거 비활성화
-- physical_inventory_items 업데이트 시 자동으로 inventory_transactions에 삽입하는 트리거 제거

-- 1. physical_inventory_items 관련 트리거 삭제
DROP TRIGGER IF EXISTS trigger_process_physical_inventory_adjustment ON physical_inventory_items;

-- 2. 관련 함수 삭제 (선택사항)
-- DROP FUNCTION IF EXISTS process_physical_inventory_adjustment();

-- 3. 트리거 삭제 확인
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'physical_inventory_items';

-- 4. 결과 확인
-- 위 쿼리 결과가 비어있으면 트리거가 성공적으로 삭제된 것입니다.
