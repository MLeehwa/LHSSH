-- ============================================================
-- 2026-02-19 inventory.current_stock + 스냅샷 재구축
-- 2/18 마감재고(스냅샷) + 2/19 입출고 거래 기반으로 재계산
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================================

-- 1. 먼저 현재 상태 확인 (실행 전 대조용)
SELECT '=== 재구축 전 확인 ===' AS step;

SELECT 
    p.part_number,
    s18.closing_stock AS prev_closing_2_18,
    COALESCE(inb.total_inbound, 0) AS inbound_2_19,
    COALESCE(outb.total_outbound, 0) AS outbound_2_19,
    s18.closing_stock + COALESCE(inb.total_inbound, 0) - COALESCE(outb.total_outbound, 0) AS correct_stock,
    i.current_stock AS current_inventory,
    s19.closing_stock AS current_snapshot_2_19
FROM parts p
LEFT JOIN daily_inventory_snapshot s18 
    ON s18.part_number = p.part_number AND s18.snapshot_date = '2026-02-18'
LEFT JOIN inventory i 
    ON i.part_number = p.part_number
LEFT JOIN daily_inventory_snapshot s19 
    ON s19.part_number = p.part_number AND s19.snapshot_date = '2026-02-19'
LEFT JOIN (
    SELECT part_number, SUM(quantity) AS total_inbound
    FROM inventory_transactions
    WHERE transaction_date = '2026-02-19' AND transaction_type = 'INBOUND'
    GROUP BY part_number
) inb ON inb.part_number = p.part_number
LEFT JOIN (
    SELECT part_number, SUM(quantity) AS total_outbound
    FROM inventory_transactions
    WHERE transaction_date = '2026-02-19' AND transaction_type = 'OUTBOUND'
    GROUP BY part_number
) outb ON outb.part_number = p.part_number
WHERE p.status = 'ACTIVE'
  AND s18.closing_stock IS NOT NULL
ORDER BY p.part_number;

-- 2. inventory.current_stock 업데이트 (2/18 마감 + 2/19 거래)
UPDATE inventory i
SET 
    current_stock = s18.closing_stock 
        + COALESCE(inb.total_inbound, 0) 
        - COALESCE(outb.total_outbound, 0),
    last_updated = NOW()
FROM daily_inventory_snapshot s18
LEFT JOIN (
    SELECT part_number, SUM(quantity) AS total_inbound
    FROM inventory_transactions
    WHERE transaction_date = '2026-02-19' AND transaction_type = 'INBOUND'
    GROUP BY part_number
) inb ON inb.part_number = s18.part_number
LEFT JOIN (
    SELECT part_number, SUM(quantity) AS total_outbound
    FROM inventory_transactions
    WHERE transaction_date = '2026-02-19' AND transaction_type = 'OUTBOUND'
    GROUP BY part_number
) outb ON outb.part_number = s18.part_number
WHERE s18.snapshot_date = '2026-02-18'
  AND i.part_number = s18.part_number;

-- 3. 2/19 스냅샷 삭제 후 재생성 (재계산된 current_stock 기반)
DELETE FROM daily_inventory_snapshot
WHERE snapshot_date = '2026-02-19';

INSERT INTO daily_inventory_snapshot (snapshot_date, part_number, closing_stock)
SELECT 
    '2026-02-19'::DATE,
    i.part_number,
    i.current_stock
FROM inventory i
INNER JOIN parts p ON p.part_number = i.part_number
WHERE p.status = 'ACTIVE'
  AND i.current_stock IS NOT NULL
ON CONFLICT (snapshot_date, part_number) 
DO UPDATE SET 
    closing_stock = EXCLUDED.closing_stock,
    updated_at = NOW();

-- 4. 결과 확인
SELECT '=== 재구축 후 확인 ===' AS step;

SELECT 
    i.part_number,
    i.current_stock,
    s19.closing_stock AS snapshot_2_19,
    CASE WHEN i.current_stock = s19.closing_stock THEN 'OK' ELSE 'MISMATCH' END AS status
FROM inventory i
INNER JOIN parts p ON p.part_number = i.part_number
LEFT JOIN daily_inventory_snapshot s19 
    ON s19.part_number = i.part_number AND s19.snapshot_date = '2026-02-19'
WHERE p.status = 'ACTIVE'
ORDER BY i.part_number;
