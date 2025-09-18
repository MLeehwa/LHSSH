-- 간단한 해결책: RLS 완전 비활성화

-- 1. RLS 비활성화
ALTER TABLE daily_inventory_summary DISABLE ROW LEVEL SECURITY;

-- 2. 모든 정책 삭제
DROP POLICY IF EXISTS "daily_inventory_summary_select_policy" ON daily_inventory_summary;
DROP POLICY IF EXISTS "daily_inventory_summary_insert_policy" ON daily_inventory_summary;
DROP POLICY IF EXISTS "daily_inventory_summary_update_policy" ON daily_inventory_summary;
DROP POLICY IF EXISTS "daily_inventory_summary_delete_policy" ON daily_inventory_summary;

-- 3. 권한 부여
GRANT ALL ON daily_inventory_summary TO public;
GRANT ALL ON daily_inventory_summary TO anon;
GRANT ALL ON daily_inventory_summary TO authenticated;

-- 4. 테스트
SELECT COUNT(*) as total_records FROM daily_inventory_summary;
