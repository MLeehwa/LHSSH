-- =====================================================
-- 트리거 삭제: trigger_track_inventory_movement
-- =====================================================
-- 2배 차감 문제 해결을 위해 inventory_transactions 트리거 삭제
-- JavaScript에서 직접 inventory 테이블을 관리하도록 변경

-- 1. 트리거 삭제
DROP TRIGGER IF EXISTS trigger_track_inventory_movement ON inventory_transactions;

-- 2. 관련 함수도 삭제 (선택사항)
-- DROP FUNCTION IF EXISTS track_inventory_movement();

-- 3. 삭제 확인
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'inventory_transactions';

-- 4. 결과 확인
-- 위 쿼리 결과가 비어있으면 트리거가 성공적으로 삭제된 것입니다.
