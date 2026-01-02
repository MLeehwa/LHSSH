-- 과거 기록과 오늘 재고를 전체적으로 서버에 올리는 마이그레이션 스크립트
-- 가장 효율적인 방법: 기준일 재고 설정 → 과거 거래 내역 삽입 → 최종 재고 확인

-- ============================================
-- ⚠️ 중요: 날짜 순서와 재고 설정 순서
-- ============================================
-- ❌ 잘못된 방법:
--   1. 어제(11/13) 마감 재고를 inventory에 설정
--   2. 11/1~11/13 거래 내역 삽입
--   → 결과: 재고가 중복 계산됨! (11/13 재고 + 11/1~11/13 거래 내역)
--
-- ✅ 올바른 방법:
--   1. 시작일(11/1) 재고를 inventory에 설정
--   2. 11/1~11/13 거래 내역을 날짜 순서대로 삽입
--   3. 11/13 마감 재고와 계산된 재고 비교 후 ADJUSTMENT로 조정
--
-- 또는:
--   1. 트리거 비활성화
--   2. 11/1~11/13 거래 내역 삽입
--   3. 11/13 마감 재고를 inventory에 직접 설정
--   4. 트리거 재활성화

-- ============================================
-- 방법 1: 시작일 재고 설정 후 과거 거래 내역 삽입 (권장)
-- ============================================

-- 1단계: 시작일(예: 2024-11-01)의 재고를 먼저 inventory 테이블에 설정
-- ⚠️ 중요: 어제 마감 재고가 아니라 시작일 재고를 설정해야 합니다!
-- 이 부분은 실제 재고 데이터를 CSV나 Excel로 준비해서 삽입해야 합니다
-- 예시:
/*
INSERT INTO inventory (part_number, current_stock, last_updated)
VALUES 
    ('49560-L3010', 100, '2024-11-01'),  -- 11/1 시작 재고
    ('49560-S9000', 50, '2024-11-01'),   -- 11/1 시작 재고
    -- ... 모든 파트의 시작일 재고
ON CONFLICT (part_number) 
DO UPDATE SET 
    current_stock = EXCLUDED.current_stock,
    last_updated = EXCLUDED.last_updated;
*/

-- 2단계: 시작일 이후의 모든 거래 내역을 날짜 순서대로 삽입
-- 트리거가 자동으로 inventory를 업데이트합니다
-- ⚠️ 중요: 날짜 순서대로 삽입해야 합니다!
-- 예시:
/*
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '과거 입고 데이터'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '과거 출고 데이터'),
    ('2024-11-03', '49560-L3010', 'INBOUND', 15, 'ARN-002', '과거 입고 데이터'),
    -- ... 11/1부터 11/13까지 모든 거래 내역을 날짜 순서대로
ORDER BY transaction_date, created_at;
*/

-- 3단계: 어제(11/13) 마감 재고 확인 및 조정
-- 어제 마감 재고와 계산된 재고를 비교하여 차이가 있으면 ADJUSTMENT로 조정
/*
WITH calculated_stock AS (
    SELECT 
        i.part_number,
        i.current_stock AS calculated_stock,  -- 11/1 시작 재고 + 11/1~11/13 거래 내역으로 계산된 재고
        actual_stock.actual_stock  -- 실제 11/13 마감 재고
    FROM inventory i
    LEFT JOIN (
        SELECT part_number, current_stock AS actual_stock 
        FROM actual_inventory_2024_11_13  -- 실제 11/13 마감 재고 데이터
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
*/

-- ============================================
-- 방법 2: 트리거 비활성화 후 어제 마감 재고 직접 설정 (대안)
-- ============================================
-- 어제 마감 재고를 먼저 올리고 싶은 경우 사용

-- 1단계: 트리거 비활성화 (재고 자동 업데이트 방지)
/*
ALTER TABLE inventory_transactions DISABLE TRIGGER trigger_track_inventory_movement;
*/

-- 2단계: 11/1~11/13 거래 내역을 날짜 순서대로 삽입
-- ⚠️ 트리거가 비활성화되어 있어서 재고는 업데이트되지 않습니다
/*
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
SELECT 
    transaction_date,
    part_number,
    transaction_type,
    quantity,
    reference_id,
    notes
FROM historical_transactions_2024_11_01_to_13  -- 11/1~11/13 거래 내역
ORDER BY transaction_date, created_at;
*/

-- 3단계: 어제(11/13) 마감 재고를 inventory에 직접 설정
/*
INSERT INTO inventory (part_number, current_stock, last_updated)
SELECT 
    part_number,
    actual_stock,  -- 실제 11/13 마감 재고
    '2024-11-13'
FROM actual_inventory_2024_11_13  -- 실제 11/13 마감 재고 데이터
ON CONFLICT (part_number) 
DO UPDATE SET 
    current_stock = EXCLUDED.current_stock,
    last_updated = EXCLUDED.last_updated;
*/

-- 4단계: 트리거 재활성화
/*
ALTER TABLE inventory_transactions ENABLE TRIGGER trigger_track_inventory_movement;
*/

-- ⚠️ 주의: 이 방법을 사용하면 이후 새로운 거래 내역이 삽입될 때만 재고가 업데이트됩니다.
-- 11/1~11/13 거래 내역은 기록만 되고 재고 계산에는 반영되지 않습니다.

-- ============================================
-- 성능 최적화 팁
-- ============================================

-- 1. 배치 삽입 사용 (1000건씩)
-- 대량 데이터 삽입 시 성능 향상

-- 2. 트리거 일시 비활성화 (선택사항)
-- 매우 대량의 데이터 삽입 시 트리거를 일시 비활성화하고 마지막에 재활성화
/*
ALTER TABLE inventory_transactions DISABLE TRIGGER trigger_track_inventory_movement;

-- 대량 데이터 삽입
INSERT INTO inventory_transactions ...;

-- 트리거 재활성화
ALTER TABLE inventory_transactions ENABLE TRIGGER trigger_track_inventory_movement;

-- 재고 재계산 (필요시)
UPDATE inventory i
SET current_stock = (
    SELECT COALESCE(SUM(
        CASE 
            WHEN it.transaction_type = 'INBOUND' THEN it.quantity
            WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
            WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
        END
    ), 0)
    FROM inventory_transactions it
    WHERE it.part_number = i.part_number
);
*/

-- 3. 인덱스 확인
-- transaction_date, part_number에 인덱스가 있는지 확인
-- (스키마에 이미 생성되어 있음)

-- ============================================
-- 검증 쿼리
-- ============================================

-- 1. 거래 내역 건수 확인
SELECT 
    transaction_type,
    COUNT(*) AS count,
    MIN(transaction_date) AS earliest_date,
    MAX(transaction_date) AS latest_date
FROM inventory_transactions
GROUP BY transaction_type;

-- 2. 재고 일관성 확인
SELECT 
    i.part_number,
    i.current_stock AS inventory_stock,
    COALESCE(SUM(
        CASE 
            WHEN it.transaction_type = 'INBOUND' THEN it.quantity
            WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
            WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
        END
    ), 0) AS calculated_stock,
    i.current_stock - COALESCE(SUM(
        CASE 
            WHEN it.transaction_type = 'INBOUND' THEN it.quantity
            WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
            WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
        END
    ), 0) AS difference
FROM inventory i
LEFT JOIN inventory_transactions it ON i.part_number = it.part_number
GROUP BY i.part_number, i.current_stock
HAVING i.current_stock != COALESCE(SUM(
    CASE 
        WHEN it.transaction_type = 'INBOUND' THEN it.quantity
        WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
        WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
    END
), 0);

-- 3. 날짜별 거래 내역 요약
SELECT 
    transaction_date,
    transaction_type,
    COUNT(*) AS transaction_count,
    SUM(quantity) AS total_quantity
FROM inventory_transactions
GROUP BY transaction_date, transaction_type
ORDER BY transaction_date DESC, transaction_type;

