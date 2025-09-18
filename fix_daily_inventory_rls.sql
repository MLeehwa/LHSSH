-- daily_inventory_summary 테이블 RLS 정책 설정
-- 권한 문제 해결을 위한 SQL

-- 1. daily_inventory_summary 테이블에 RLS 활성화
ALTER TABLE daily_inventory_summary ENABLE ROW LEVEL SECURITY;

-- 2. 모든 사용자가 읽기 가능하도록 정책 생성
CREATE POLICY "daily_inventory_summary_select_policy" ON daily_inventory_summary
    FOR SELECT
    USING (true);

-- 3. 인증된 사용자가 삽입 가능하도록 정책 생성
CREATE POLICY "daily_inventory_summary_insert_policy" ON daily_inventory_summary
    FOR INSERT
    WITH CHECK (true);

-- 4. 인증된 사용자가 업데이트 가능하도록 정책 생성
CREATE POLICY "daily_inventory_summary_update_policy" ON daily_inventory_summary
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 5. 인증된 사용자가 삭제 가능하도록 정책 생성
CREATE POLICY "daily_inventory_summary_delete_policy" ON daily_inventory_summary
    FOR DELETE
    USING (true);

-- 6. 기존 정책이 있다면 삭제 (중복 방지)
DROP POLICY IF EXISTS "daily_inventory_summary_select_policy" ON daily_inventory_summary;
DROP POLICY IF EXISTS "daily_inventory_summary_insert_policy" ON daily_inventory_summary;
DROP POLICY IF EXISTS "daily_inventory_summary_update_policy" ON daily_inventory_summary;
DROP POLICY IF EXISTS "daily_inventory_summary_delete_policy" ON daily_inventory_summary;

-- 7. 정책 재생성
CREATE POLICY "daily_inventory_summary_select_policy" ON daily_inventory_summary
    FOR SELECT
    USING (true);

CREATE POLICY "daily_inventory_summary_insert_policy" ON daily_inventory_summary
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "daily_inventory_summary_update_policy" ON daily_inventory_summary
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "daily_inventory_summary_delete_policy" ON daily_inventory_summary
    FOR DELETE
    USING (true);

-- 8. 테이블 권한 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    hasrls
FROM pg_tables 
WHERE tablename = 'daily_inventory_summary';

-- 9. 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'daily_inventory_summary';

-- 10. 테스트 쿼리
SELECT COUNT(*) as total_records FROM daily_inventory_summary;

-- 11. 샘플 데이터 확인
SELECT 
    summary_date,
    part_number,
    current_stock,
    today_inbound,
    today_outbound
FROM daily_inventory_summary 
ORDER BY summary_date DESC 
LIMIT 5;
