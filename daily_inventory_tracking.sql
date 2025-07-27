DROP TABLE IF EXISTS daily_inventory_snapshots CASCADE;
DROP TABLE IF EXISTS daily_inventory_summary CASCADE;

CREATE TABLE daily_inventory_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    opening_stock INTEGER NOT NULL DEFAULT 0,
    closing_stock INTEGER NOT NULL DEFAULT 0,
    daily_inbound INTEGER NOT NULL DEFAULT 0,
    daily_outbound INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE,
    UNIQUE(snapshot_date, part_number)
);

CREATE TABLE daily_inventory_summary (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL UNIQUE,
    total_parts INTEGER NOT NULL DEFAULT 0,
    total_opening_stock INTEGER NOT NULL DEFAULT 0,
    total_closing_stock INTEGER NOT NULL DEFAULT 0,
    total_daily_inbound INTEGER NOT NULL DEFAULT 0,
    total_daily_outbound INTEGER NOT NULL DEFAULT 0,
    parts_with_movement INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daily_snapshots_date ON daily_inventory_snapshots(snapshot_date);
CREATE INDEX idx_daily_snapshots_part_number ON daily_inventory_snapshots(part_number);
CREATE INDEX idx_daily_summary_date ON daily_inventory_summary(summary_date);

CREATE OR REPLACE FUNCTION create_daily_inventory_snapshot(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    part_record RECORD;
    previous_snapshot RECORD;
    current_inventory RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM daily_inventory_snapshots WHERE snapshot_date = target_date) THEN
        RAISE NOTICE '스냅샷이 이미 존재합니다: %', target_date;
        RETURN;
    END IF;

    FOR part_record IN 
        SELECT part_number FROM parts WHERE status = 'ACTIVE'
    LOOP
        SELECT closing_stock INTO previous_snapshot
        FROM daily_inventory_snapshots 
        WHERE part_number = part_record.part_number 
        AND snapshot_date = target_date - INTERVAL '1 day';
        
        SELECT current_stock, today_inbound, today_outbound INTO current_inventory
        FROM inventory 
        WHERE part_number = part_record.part_number;
        
        INSERT INTO daily_inventory_snapshots (
            snapshot_date,
            part_number,
            opening_stock,
            closing_stock,
            daily_inbound,
            daily_outbound
        ) VALUES (
            target_date,
            part_record.part_number,
            COALESCE(previous_snapshot.closing_stock, 0),
            COALESCE(current_inventory.current_stock, 0),
            COALESCE(current_inventory.today_inbound, 0),
            COALESCE(current_inventory.today_outbound, 0)
        );
    END LOOP;
    
    PERFORM create_daily_summary(target_date);
    
    RAISE NOTICE '일일 재고 스냅샷 생성 완료: %', target_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    summary_data RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM daily_inventory_summary WHERE summary_date = target_date) THEN
        RAISE NOTICE '일일 요약이 이미 존재합니다: %', target_date;
        RETURN;
    END IF;

    SELECT 
        COUNT(*) as total_parts,
        SUM(opening_stock) as total_opening_stock,
        SUM(closing_stock) as total_closing_stock,
        SUM(daily_inbound) as total_daily_inbound,
        SUM(daily_outbound) as total_daily_outbound,
        COUNT(CASE WHEN daily_inbound > 0 OR daily_outbound > 0 THEN 1 END) as parts_with_movement
    INTO summary_data
    FROM daily_inventory_snapshots 
    WHERE snapshot_date = target_date;

    INSERT INTO daily_inventory_summary (
        summary_date,
        total_parts,
        total_opening_stock,
        total_closing_stock,
        total_daily_inbound,
        total_daily_outbound,
        parts_with_movement
    ) VALUES (
        target_date,
        COALESCE(summary_data.total_parts, 0),
        COALESCE(summary_data.total_opening_stock, 0),
        COALESCE(summary_data.total_closing_stock, 0),
        COALESCE(summary_data.total_daily_inbound, 0),
        COALESCE(summary_data.total_daily_outbound, 0),
        COALESCE(summary_data.parts_with_movement, 0)
    );
    
    RAISE NOTICE '일일 요약 생성 완료: %', target_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION track_inventory_movement(
    p_part_number VARCHAR(50),
    p_quantity INTEGER,
    p_type VARCHAR(20),
    p_reference_number VARCHAR(50)
)
RETURNS VOID AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    current_snapshot RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM daily_inventory_snapshots WHERE snapshot_date = current_date AND part_number = p_part_number) THEN
        PERFORM create_daily_inventory_snapshot(current_date);
    END IF;
    
    SELECT * INTO current_snapshot 
    FROM daily_inventory_snapshots 
    WHERE snapshot_date = current_date AND part_number = p_part_number;
    
    IF p_type = 'INBOUND' THEN
        UPDATE daily_inventory_snapshots 
        SET daily_inbound = daily_inbound + p_quantity,
            closing_stock = closing_stock + p_quantity
        WHERE snapshot_date = current_date AND part_number = p_part_number;
    ELSIF p_type = 'OUTBOUND' THEN
        UPDATE daily_inventory_snapshots 
        SET daily_outbound = daily_outbound + p_quantity,
            closing_stock = closing_stock - p_quantity
        WHERE snapshot_date = current_date AND part_number = p_part_number;
    END IF;
    
    PERFORM update_daily_summary(current_date);
    
    RAISE NOTICE '재고 변동 추적 완료: % % %개', p_part_number, p_type, p_quantity;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    summary_data RECORD;
BEGIN
    SELECT 
        COUNT(*) as total_parts,
        SUM(opening_stock) as total_opening_stock,
        SUM(closing_stock) as total_closing_stock,
        SUM(daily_inbound) as total_daily_inbound,
        SUM(daily_outbound) as total_daily_outbound,
        COUNT(CASE WHEN daily_inbound > 0 OR daily_outbound > 0 THEN 1 END) as parts_with_movement
    INTO summary_data
    FROM daily_inventory_snapshots 
    WHERE snapshot_date = target_date;

    UPDATE daily_inventory_summary 
    SET 
        total_parts = COALESCE(summary_data.total_parts, 0),
        total_opening_stock = COALESCE(summary_data.total_opening_stock, 0),
        total_closing_stock = COALESCE(summary_data.total_closing_stock, 0),
        total_daily_inbound = COALESCE(summary_data.total_daily_inbound, 0),
        total_daily_outbound = COALESCE(summary_data.total_daily_outbound, 0),
        parts_with_movement = COALESCE(summary_data.parts_with_movement, 0),
        updated_at = NOW()
    WHERE summary_date = target_date;
    
    IF NOT FOUND THEN
        PERFORM create_daily_summary(target_date);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_inventory_consistency(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    part_number VARCHAR(50),
    expected_stock INTEGER,
    actual_stock INTEGER,
    discrepancy INTEGER,
    issue_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.part_number,
        s.opening_stock + s.daily_inbound - s.daily_outbound as expected_stock,
        s.closing_stock as actual_stock,
        (s.opening_stock + s.daily_inbound - s.daily_outbound) - s.closing_stock as discrepancy,
        CASE 
            WHEN s.closing_stock < 0 THEN 'NEGATIVE_STOCK'
            WHEN (s.opening_stock + s.daily_inbound - s.daily_outbound) != s.closing_stock THEN 'CALCULATION_MISMATCH'
            ELSE 'OK'
        END as issue_type
    FROM daily_inventory_snapshots s
    WHERE s.snapshot_date = target_date
    AND (
        s.closing_stock < 0 
        OR (s.opening_stock + s.daily_inbound - s.daily_outbound) != s.closing_stock
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_inventory_history(
    p_part_number VARCHAR(50),
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    snapshot_date DATE,
    opening_stock INTEGER,
    closing_stock INTEGER,
    daily_inbound INTEGER,
    daily_outbound INTEGER,
    net_movement INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.snapshot_date,
        s.opening_stock,
        s.closing_stock,
        s.daily_inbound,
        s.daily_outbound,
        s.daily_inbound - s.daily_outbound as net_movement
    FROM daily_inventory_snapshots s
    WHERE s.part_number = p_part_number
    AND s.snapshot_date BETWEEN start_date AND end_date
    ORDER BY s.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE daily_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_inventory_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all users" ON daily_inventory_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON daily_inventory_summary FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON daily_inventory_snapshots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON daily_inventory_snapshots FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON daily_inventory_summary FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON daily_inventory_summary FOR UPDATE USING (auth.role() = 'authenticated');

CREATE VIEW daily_inventory_status AS
SELECT 
    s.snapshot_date,
    s.part_number,
    p.category,
    s.opening_stock,
    s.closing_stock,
    s.daily_inbound,
    s.daily_outbound,
    s.opening_stock + s.daily_inbound - s.daily_outbound as calculated_closing_stock,
    CASE 
        WHEN s.closing_stock < 0 THEN 'NEGATIVE_STOCK'
        WHEN (s.opening_stock + s.daily_inbound - s.daily_outbound) != s.closing_stock THEN 'CALCULATION_ERROR'
        ELSE 'OK'
    END as validation_status
FROM daily_inventory_snapshots s
JOIN parts p ON s.part_number = p.part_number
WHERE p.status = 'ACTIVE'
ORDER BY s.snapshot_date DESC, s.part_number;

CREATE VIEW monthly_inventory_summary AS
SELECT 
    DATE_TRUNC('month', summary_date) as month,
    COUNT(*) as days_with_data,
    AVG(total_parts) as avg_total_parts,
    AVG(total_opening_stock) as avg_opening_stock,
    AVG(total_closing_stock) as avg_closing_stock,
    SUM(total_daily_inbound) as total_monthly_inbound,
    SUM(total_daily_outbound) as total_monthly_outbound,
    MAX(total_daily_inbound) as max_daily_inbound,
    MAX(total_daily_outbound) as max_daily_outbound
FROM daily_inventory_summary
GROUP BY DATE_TRUNC('month', summary_date)
ORDER BY month DESC;

SELECT create_daily_inventory_snapshot(CURRENT_DATE);
SELECT create_daily_inventory_snapshot((CURRENT_DATE - INTERVAL '1 day')::DATE); 