-- ============================================
-- 실제 예시: 11/1~11/13 거래 내역 + 11/13 마감 재고 마이그레이션
-- ============================================

-- ⚠️ 중요: 과거 기록을 올리고 지금 재고를 올리면 지난 날짜의 예상 재고를 알 수 있습니다!
-- 재고 현황 페이지에서 과거 날짜를 선택하면 자동으로 계산됩니다.

-- ============================================
-- 방법 1: 트리거 비활성화 후 과거 기록 + 지금 재고 설정 (일자별 재고 추적 가능)
-- ============================================
-- 이 방법을 사용하면 재고 현황 페이지에서 과거 날짜의 재고를 자동으로 계산할 수 있습니다.

-- 1단계: 트리거 비활성화 (재고 자동 업데이트 방지)
ALTER TABLE inventory_transactions DISABLE TRIGGER trigger_track_inventory_movement;

-- 2단계: 11/1~11/13 거래 내역을 날짜 순서대로 삽입
-- ⚠️ 트리거가 비활성화되어 있어서 재고는 업데이트되지 않습니다 (기록만)
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '11/1 입고'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '11/2 출고'),
    ('2024-11-03', '49560-L3010', 'INBOUND', 15, 'ARN-002', '11/3 입고'),
    -- ... 11/1부터 11/13까지 모든 거래 내역을 날짜 순서대로
ORDER BY transaction_date, created_at;

-- 3단계: 지금 재고(11/13 마감 재고)를 inventory에 직접 설정
INSERT INTO inventory (part_number, current_stock, last_updated)
VALUES 
    ('49560-L3010', 125, '2024-11-13'),  -- 실제 11/13 마감 재고
    ('49560-S9000', 60, '2024-11-13'),   -- 실제 11/13 마감 재고
    -- ... 모든 파트의 실제 11/13 마감 재고
ON CONFLICT (part_number) 
DO UPDATE SET 
    current_stock = EXCLUDED.current_stock,
    last_updated = EXCLUDED.last_updated;

-- 4단계: 트리거 재활성화
ALTER TABLE inventory_transactions ENABLE TRIGGER trigger_track_inventory_movement;

-- ✅ 결과:
-- - 11/1~11/13 거래 내역이 기록됨
-- - 11/13 마감 재고가 inventory에 설정됨
-- - 재고 현황 페이지에서 11/5 같은 과거 날짜를 선택하면:
--   → 현재 재고(11/13)에서 11/6~11/13 거래를 역산하여 11/5 전날 재고 계산
--   → 11/5 거래 내역 집계
--   → 11/5 예상 재고 = 전날 재고 + 11/5 입고 - 11/5 출고 + 11/5 조정
--   → 자동으로 계산되어 표시됨!

-- ============================================
-- 방법 2: 시작일 재고 설정 후 거래 내역 삽입 (권장 - 더 정확)
-- ============================================

-- 1단계: 11/1 시작 재고를 inventory 테이블에 설정
-- ⚠️ 중요: 어제(11/13) 마감 재고가 아니라 11/1 시작 재고를 설정해야 합니다!
INSERT INTO inventory (part_number, current_stock, last_updated)
VALUES 
    ('49560-L3010', 100, '2024-11-01'),  -- 11/1 시작 재고
    ('49560-S9000', 50, '2024-11-01'),   -- 11/1 시작 재고
    -- ... 모든 파트의 11/1 시작 재고
ON CONFLICT (part_number) 
DO UPDATE SET 
    current_stock = EXCLUDED.current_stock,
    last_updated = EXCLUDED.last_updated;

-- 2단계: 11/1~11/13 거래 내역을 날짜 순서대로 삽입
-- 트리거가 자동으로 inventory를 업데이트합니다
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '11/1 입고'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '11/2 출고'),
    ('2024-11-03', '49560-L3010', 'INBOUND', 15, 'ARN-002', '11/3 입고'),
    -- ... 11/1부터 11/13까지 모든 거래 내역을 날짜 순서대로
ORDER BY transaction_date, created_at;

-- 3단계: 11/13 마감 재고 확인 및 조정
-- 실제 11/13 마감 재고와 계산된 재고를 비교하여 차이가 있으면 ADJUSTMENT로 조정
WITH calculated_stock AS (
    SELECT 
        i.part_number,
        i.current_stock AS calculated_stock,  -- 11/1 시작 재고 + 11/1~11/13 거래 내역으로 계산된 재고
        actual_stock.actual_stock  -- 실제 11/13 마감 재고
    FROM inventory i
    LEFT JOIN (
        -- 실제 11/13 마감 재고 데이터 (CSV나 Excel에서 가져온 데이터)
        SELECT '49560-L3010' AS part_number, 125 AS actual_stock
        UNION ALL
        SELECT '49560-S9000' AS part_number, 60 AS actual_stock
        -- ... 모든 파트의 실제 11/13 마감 재고
    ) actual_stock ON i.part_number = actual_stock.part_number
)
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
SELECT 
    '2024-11-13',  -- 어제 날짜
    part_number,
    'ADJUSTMENT',
    COALESCE(actual_stock, calculated_stock) - calculated_stock,  -- 차이만큼 조정
    'MIGRATION_ADJUSTMENT_2024_11_13',
    '마이그레이션: 11/13 마감 재고 조정'
FROM calculated_stock
WHERE COALESCE(actual_stock, calculated_stock) != calculated_stock;  -- 차이가 있는 경우만

-- ============================================
-- 방법 2: 트리거 비활성화 후 어제 마감 재고 직접 설정 (대안)
-- ============================================

-- 1단계: 트리거 비활성화 (재고 자동 업데이트 방지)
ALTER TABLE inventory_transactions DISABLE TRIGGER trigger_track_inventory_movement;

-- 2단계: 11/1~11/13 거래 내역을 날짜 순서대로 삽입
-- ⚠️ 트리거가 비활성화되어 있어서 재고는 업데이트되지 않습니다
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '11/1 입고'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '11/2 출고'),
    -- ... 11/1부터 11/13까지 모든 거래 내역
ORDER BY transaction_date, created_at;

-- 3단계: 어제(11/13) 마감 재고를 inventory에 직접 설정
INSERT INTO inventory (part_number, current_stock, last_updated)
VALUES 
    ('49560-L3010', 125, '2024-11-13'),  -- 실제 11/13 마감 재고
    ('49560-S9000', 60, '2024-11-13'),   -- 실제 11/13 마감 재고
    -- ... 모든 파트의 실제 11/13 마감 재고
ON CONFLICT (part_number) 
DO UPDATE SET 
    current_stock = EXCLUDED.current_stock,
    last_updated = EXCLUDED.last_updated;

-- 4단계: 트리거 재활성화
ALTER TABLE inventory_transactions ENABLE TRIGGER trigger_track_inventory_movement;

-- ⚠️ 주의: 이 방법을 사용하면 이후 새로운 거래 내역이 삽입될 때만 재고가 업데이트됩니다.
-- 11/1~11/13 거래 내역은 기록만 되고 재고 계산에는 반영되지 않습니다.

