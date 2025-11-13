-- 고유번호 전용 테이블 생성
-- 바코드 스캔 시점에 바로 저장되는 고유번호 테이블

CREATE TABLE IF NOT EXISTS scanned_unique_codes (
    id SERIAL PRIMARY KEY,
    unique_code VARCHAR(255) NOT NULL UNIQUE,
    arn_number VARCHAR(50),
    part_number VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 1, -- 해당 고유번호로 스캔된 수량
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    inbound_date DATE, -- 입고 확정 날짜
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (arn_number) REFERENCES arn_containers(arn_number) ON DELETE SET NULL
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_scanned_unique_codes_unique_code ON scanned_unique_codes(unique_code);
CREATE INDEX IF NOT EXISTS idx_scanned_unique_codes_arn_number ON scanned_unique_codes(arn_number);
CREATE INDEX IF NOT EXISTS idx_scanned_unique_codes_status ON scanned_unique_codes(status);
CREATE INDEX IF NOT EXISTS idx_scanned_unique_codes_part_number ON scanned_unique_codes(part_number);
CREATE INDEX IF NOT EXISTS idx_scanned_unique_codes_inbound_date ON scanned_unique_codes(inbound_date);
CREATE INDEX IF NOT EXISTS idx_scanned_unique_codes_scanned_at ON scanned_unique_codes(scanned_at);

-- 코멘트 추가
COMMENT ON TABLE scanned_unique_codes IS '바코드 스캔 시점에 바로 저장되는 고유번호 테이블';
COMMENT ON COLUMN scanned_unique_codes.unique_code IS '바코드에서 추출한 고유번호 (UNIQUE 제약조건)';
COMMENT ON COLUMN scanned_unique_codes.arn_number IS 'ARN 컨테이너 번호 (NULL 허용 - 스캔 시점에 컨테이너가 선택되지 않았을 수 있음)';
COMMENT ON COLUMN scanned_unique_codes.part_number IS '파트 번호';
COMMENT ON COLUMN scanned_unique_codes.quantity IS '해당 고유번호로 스캔된 수량';
COMMENT ON COLUMN scanned_unique_codes.scanned_at IS '바코드 스캔 시점';
COMMENT ON COLUMN scanned_unique_codes.status IS '상태: PENDING(대기), COMPLETED(완료)';
COMMENT ON COLUMN scanned_unique_codes.inbound_date IS '입고 확정 날짜';

