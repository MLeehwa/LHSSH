-- Migration: Add product_type column to parts table
-- Date: 2024
-- Description: 양산 제품과 자주 안나가는 제품을 구분하기 위한 컬럼 추가

-- 1. product_type 컬럼 추가
ALTER TABLE parts 
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'PRODUCTION' 
CHECK (product_type IN ('PRODUCTION', 'AS'));

-- 2. 기존 데이터는 모두 PRODUCTION으로 설정 (기본값이지만 명시적으로 업데이트)
UPDATE parts 
SET product_type = 'PRODUCTION' 
WHERE product_type IS NULL;

-- 3. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_parts_product_type ON parts(product_type);
CREATE INDEX IF NOT EXISTS idx_parts_status_product_type ON parts(status, product_type);

-- 4. 코멘트 추가
COMMENT ON COLUMN parts.product_type IS '제품 유형: PRODUCTION(양산 제품), AS(AS 제품)';

-- 5. 확인 쿼리
SELECT 
    product_type,
    COUNT(*) as count
FROM parts
GROUP BY product_type;

