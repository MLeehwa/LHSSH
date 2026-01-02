-- Fix product_type constraint issue
-- 이 스크립트는 기존 제약 조건을 확인하고 수정합니다.

-- 1. 기존 제약 조건 확인
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'parts'::regclass
AND conname LIKE '%product_type%';

-- 2. 기존 제약 조건 삭제 (있다면)
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_product_type_check;
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_product_type_check1;

-- 3. product_type 컬럼이 없으면 추가
ALTER TABLE parts 
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'PRODUCTION';

-- 4. 기존 데이터 업데이트 (NULL이거나 잘못된 값이 있는 경우)
UPDATE parts 
SET product_type = 'PRODUCTION' 
WHERE product_type IS NULL 
   OR product_type NOT IN ('PRODUCTION', 'AS');

-- 5. 새로운 제약 조건 추가
ALTER TABLE parts 
ADD CONSTRAINT parts_product_type_check 
CHECK (product_type IN ('PRODUCTION', 'AS'));

-- 6. 확인
SELECT 
    product_type,
    COUNT(*) as count
FROM parts
GROUP BY product_type;

