-- ============================================
-- 역산 방법: 11/13 마감 재고와 11/1~11/13 거래 내역으로 11/1 시작 재고 계산
-- ============================================

-- 상황:
-- - 11/13 마감 재고를 알고 있음
-- - 11/1~11/13 거래 내역을 알고 있음
-- - 11/1 시작 재고를 모름
-- → 역산으로 11/1 시작 재고를 계산

-- ============================================
-- 방법 1: 역산 계산 후 시작 재고 설정 (권장)
-- ============================================

-- 1단계: 11/1 시작 재고를 역산 계산
-- 11/13 마감 재고 - (11/1~11/13 거래 내역 합계) = 11/1 시작 재고
WITH transaction_summary AS (
    SELECT 
        part_number,
        SUM(
            CASE 
                WHEN transaction_type = 'INBOUND' THEN quantity
                WHEN transaction_type = 'OUTBOUND' THEN -quantity
                WHEN transaction_type = 'ADJUSTMENT' THEN quantity
            END
        ) AS net_change  -- 11/1~11/13 동안의 순 변화량
    FROM inventory_transactions
    WHERE transaction_date >= '2024-11-01' 
      AND transaction_date <= '2024-11-13'
    GROUP BY part_number
),
final_stock AS (
    -- 실제 11/13 마감 재고 데이터 (CSV나 Excel에서 가져온 데이터)
    SELECT '49560-L3010' AS part_number, 125 AS final_stock
    UNION ALL
    SELECT '49560-S9000' AS part_number, 60 AS final_stock
    -- ... 모든 파트의 실제 11/13 마감 재고
)
SELECT 
    fs.part_number,
    fs.final_stock AS final_stock_2024_11_13,  -- 11/13 마감 재고
    COALESCE(ts.net_change, 0) AS net_change_11_01_to_11_13,  -- 11/1~11/13 순 변화량
    fs.final_stock - COALESCE(ts.net_change, 0) AS calculated_initial_stock_2024_11_01  -- 역산된 11/1 시작 재고
FROM final_stock fs
LEFT JOIN transaction_summary ts ON fs.part_number = ts.part_number;

-- 2단계: 계산된 11/1 시작 재고를 inventory 테이블에 설정
WITH transaction_summary AS (
    SELECT 
        part_number,
        SUM(
            CASE 
                WHEN transaction_type = 'INBOUND' THEN quantity
                WHEN transaction_type = 'OUTBOUND' THEN -quantity
                WHEN transaction_type = 'ADJUSTMENT' THEN quantity
            END
        ) AS net_change
    FROM inventory_transactions
    WHERE transaction_date >= '2024-11-01' 
      AND transaction_date <= '2024-11-13'
    GROUP BY part_number
),
final_stock AS (
    SELECT '49560-L3010' AS part_number, 125 AS final_stock
    UNION ALL
    SELECT '49560-S9000' AS part_number, 60 AS final_stock
    -- ... 모든 파트의 실제 11/13 마감 재고
)
INSERT INTO inventory (part_number, current_stock, last_updated)
SELECT 
    fs.part_number,
    fs.final_stock - COALESCE(ts.net_change, 0) AS initial_stock,  -- 역산된 11/1 시작 재고
    '2024-11-01'
FROM final_stock fs
LEFT JOIN transaction_summary ts ON fs.part_number = ts.part_number
ON CONFLICT (part_number) 
DO UPDATE SET 
    current_stock = EXCLUDED.current_stock,
    last_updated = EXCLUDED.last_updated;

-- 3단계: 11/1~11/13 거래 내역을 날짜 순서대로 삽입
-- 트리거가 자동으로 inventory를 업데이트하여 11/13 마감 재고가 됩니다
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '11/1 입고'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '11/2 출고'),
    -- ... 11/1부터 11/13까지 모든 거래 내역을 날짜 순서대로
ORDER BY transaction_date, created_at;

-- 4단계: 검증 - 11/13 재고가 맞는지 확인
SELECT 
    i.part_number,
    i.current_stock AS calculated_final_stock,  -- 계산된 11/13 재고
    fs.final_stock AS actual_final_stock,  -- 실제 11/13 마감 재고
    i.current_stock - fs.final_stock AS difference  -- 차이
FROM inventory i
JOIN (
    SELECT '49560-L3010' AS part_number, 125 AS final_stock
    UNION ALL
    SELECT '49560-S9000' AS part_number, 60 AS final_stock
    -- ... 모든 파트의 실제 11/13 마감 재고
) fs ON i.part_number = fs.part_number
WHERE i.current_stock != fs.final_stock;  -- 차이가 있는 경우만

-- ============================================
-- 방법 2: 트리거 비활성화 후 직접 설정 (더 간단)
-- ============================================

-- 1단계: 트리거 비활성화
ALTER TABLE inventory_transactions DISABLE TRIGGER trigger_track_inventory_movement;

-- 2단계: 11/1~11/13 거래 내역을 날짜 순서대로 삽입
-- ⚠️ 트리거가 비활성화되어 있어서 재고는 업데이트되지 않습니다
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '11/1 입고'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '11/2 출고'),
    -- ... 11/1부터 11/13까지 모든 거래 내역
ORDER BY transaction_date, created_at;

-- 3단계: 11/13 마감 재고를 inventory에 직접 설정
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

-- ============================================
-- 방법 3: 역산 계산 + 시작 재고 설정 + 거래 내역 재삽입 (가장 정확)
-- ============================================

-- 1단계: 11/1 시작 재고 역산 계산 및 설정
-- (방법 1의 1-2단계와 동일)

-- 2단계: 기존 11/1~11/13 거래 내역 삭제 (있다면)
DELETE FROM inventory_transactions 
WHERE transaction_date >= '2024-11-01' 
  AND transaction_date <= '2024-11-13';

-- 3단계: 11/1~11/13 거래 내역을 날짜 순서대로 재삽입
-- 트리거가 자동으로 inventory를 업데이트하여 11/13 마감 재고가 됩니다
INSERT INTO inventory_transactions (transaction_date, part_number, transaction_type, quantity, reference_id, notes)
VALUES 
    ('2024-11-01', '49560-L3010', 'INBOUND', 20, 'ARN-001', '11/1 입고'),
    ('2024-11-02', '49560-L3010', 'OUTBOUND', 10, 'SEQ-001', '11/2 출고'),
    -- ... 11/1부터 11/13까지 모든 거래 내역
ORDER BY transaction_date, created_at;

-- 4단계: 검증
-- (방법 1의 4단계와 동일)

