-- RLS 정책 수정 - inventory 및 inventory_transactions 테이블에 쓰기 권한 추가
-- 이 파일을 Supabase SQL 편집기에서 실행하세요

-- inventory 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON inventory FOR UPDATE USING (auth.role() = 'authenticated');

-- inventory_transactions 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON inventory_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON inventory_transactions FOR UPDATE USING (auth.role() = 'authenticated');

-- outbound_sequences 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON outbound_sequences FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON outbound_sequences FOR UPDATE USING (auth.role() = 'authenticated');

-- outbound_parts 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON outbound_parts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON outbound_parts FOR UPDATE USING (auth.role() = 'authenticated'); 