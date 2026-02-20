-- daily_inventory_snapshot 테이블 생성 + 권한 설정
-- Supabase Dashboard > SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS daily_inventory_snapshot (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    part_number TEXT NOT NULL,
    closing_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(snapshot_date, part_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_snapshot_date ON daily_inventory_snapshot(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshot_part ON daily_inventory_snapshot(part_number);

-- RLS 활성화
ALTER TABLE daily_inventory_snapshot ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Allow all access to daily_inventory_snapshot" ON daily_inventory_snapshot;
DROP POLICY IF EXISTS "Public Read" ON daily_inventory_snapshot;
DROP POLICY IF EXISTS "Public Insert" ON daily_inventory_snapshot;
DROP POLICY IF EXISTS "Public Update" ON daily_inventory_snapshot;
DROP POLICY IF EXISTS "Public Delete" ON daily_inventory_snapshot;

-- 새 정책 생성
CREATE POLICY "Public Read" ON daily_inventory_snapshot FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON daily_inventory_snapshot FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON daily_inventory_snapshot FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON daily_inventory_snapshot FOR DELETE USING (true);

-- ⚠️ 핵심: anon/authenticated 역할에 권한 부여
GRANT ALL ON daily_inventory_snapshot TO anon;
GRANT ALL ON daily_inventory_snapshot TO authenticated;
GRANT ALL ON daily_inventory_snapshot TO service_role;
GRANT USAGE, SELECT ON SEQUENCE daily_inventory_snapshot_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE daily_inventory_snapshot_id_seq TO authenticated;
