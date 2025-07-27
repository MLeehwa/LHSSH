-- ARN (Arrival Notice) Tables for Inbound Management
-- These tables are required for the inbound status page functionality

-- 1. ARN Containers Table
CREATE TABLE IF NOT EXISTS arn_containers (
    id SERIAL PRIMARY KEY,
    arn_number VARCHAR(50) UNIQUE NOT NULL,
    container_number VARCHAR(50) NOT NULL,
    supplier VARCHAR(100),
    arrival_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    inbound_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ARN Parts Table
CREATE TABLE IF NOT EXISTS arn_parts (
    id SERIAL PRIMARY KEY,
    arn_number VARCHAR(50) NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    scanned_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (arn_number) REFERENCES arn_containers(arn_number) ON DELETE CASCADE,
    FOREIGN KEY (part_number) REFERENCES parts(part_number) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_arn_containers_arn_number ON arn_containers(arn_number);
CREATE INDEX IF NOT EXISTS idx_arn_containers_status ON arn_containers(status);
CREATE INDEX IF NOT EXISTS idx_arn_containers_arrival_date ON arn_containers(arrival_date);
CREATE INDEX IF NOT EXISTS idx_arn_parts_arn_number ON arn_parts(arn_number);
CREATE INDEX IF NOT EXISTS idx_arn_parts_part_number ON arn_parts(part_number);
CREATE INDEX IF NOT EXISTS idx_arn_parts_status ON arn_parts(status);

-- RLS Policies for ARN tables
ALTER TABLE arn_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE arn_parts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for arn_containers
CREATE POLICY "Enable read access for all users" ON arn_containers
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON arn_containers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON arn_containers
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON arn_containers
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for arn_parts
CREATE POLICY "Enable read access for all users" ON arn_parts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON arn_parts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON arn_parts
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON arn_parts
    FOR DELETE USING (auth.role() = 'authenticated');

-- Sample data for testing
INSERT INTO arn_containers (arn_number, container_number, supplier, arrival_date, status) VALUES
('ARN-2024-001', 'CONT001', '공급업체 A', '2024-01-15', 'PENDING'),
('ARN-2024-002', 'CONT002', '공급업체 B', '2024-01-16', 'IN_PROGRESS'),
('ARN-2024-003', 'CONT003', '공급업체 C', '2024-01-17', 'COMPLETED')
ON CONFLICT (arn_number) DO NOTHING;

-- Note: arn_parts data will be added when parts are registered 